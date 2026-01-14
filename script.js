// script.js - الإصدار الكامل مع Firebase
import { 
    auth, 
    db,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    onAuthStateChanged,
    signOut,
    collection,
    addDoc,
    getDocs,
    Timestamp 
} from './firebase-config.js';

// حالة التطبيق
let currentUser = null;

// ==================== عند تحميل الصفحة ====================
document.addEventListener('DOMContentLoaded', function() {
    console.log("🚀 9esati جاهز للتشغيل!");
    
    // تحديث السنة في الفوتر
    updateCurrentYear();
    
    // إعداد مستمعي الأحداث
    setupEventListeners();
    
    // مراقبة حالة المصادقة
    setupAuthListener();
    
    // تحميل القصص عند البدء
    loadStories();
});

// ==================== وظائف المصادقة ====================

// إعداد مراقبة حالة المصادقة
function setupAuthListener() {
    onAuthStateChanged(auth, (user) => {
        currentUser = user;
        
        if (user) {
            // مستخدم مسجل الدخول
            showUserView(user.email);
            console.log("✅ مستخدم مسجل:", user.email);
        } else {
            // ضيف
            showGuestView();
            console.log("👤 مستخدم غير مسجل");
        }
    });
}

// تسجيل مستخدم جديد
async function registerUser(email, password) {
    if (!validateEmail(email)) {
        showMessage("⚠️ يرجى إدخال بريد إلكتروني صحيح", "error");
        return;
    }
    
    if (password.length < 6) {
        showMessage("⚠️ كلمة المرور يجب أن تكون 6 أحرف على الأقل", "error");
        return;
    }
    
    try {
        showLoading(true);
        await createUserWithEmailAndPassword(auth, email, password);
        showMessage(`🎉 مرحباً ${email}! تم إنشاء حسابك بنجاح`, "success");
        hideModal('registerModal');
        clearForm('registerForm');
    } catch (error) {
        handleAuthError(error);
    } finally {
        showLoading(false);
    }
}

// تسجيل الدخول
async function loginUser(email, password) {
    if (!email || !password) {
        showMessage("⚠️ يرجى ملء جميع الحقول", "error");
        return;
    }
    
    try {
        showLoading(true);
        await signInWithEmailAndPassword(auth, email, password);
        showMessage(`👋 أهلاً بعودتك ${email}!`, "success");
        hideModal('loginModal');
        clearForm('loginForm');
    } catch (error) {
        handleAuthError(error);
    } finally {
        showLoading(false);
    }
}

// تسجيل الخروج
async function logoutUser() {
    try {
        await signOut(auth);
        showMessage("✅ تم تسجيل الخروج بنجاح", "success");
    } catch (error) {
        showMessage("❌ خطأ في تسجيل الخروج", "error");
    }
}

// ==================== وظائف القصص ====================

// تحميل القصص من قاعدة البيانات
async function loadStories() {
    try {
        const storiesContainer = document.getElementById('stories-container');
        if (!storiesContainer) return;
        
        // عرض رسالة التحميل
        storiesContainer.innerHTML = `
            <div class="loading">
                <i class="fas fa-spinner fa-spin"></i>
                <p>جاري تحميل القصص...</p>
            </div>
        `;
        
        const querySnapshot = await getDocs(collection(db, "stories"));
        
        if (querySnapshot.empty) {
            storiesContainer.innerHTML = `
                <div class="no-stories">
                    <i class="fas fa-book-open"></i>
                    <h3>لا توجد قصص بعد</h3>
                    <p>كن أول من يكتب قصة بالدارجة المغربية!</p>
                    ${currentUser ? 
                        '<button onclick="showAddStoryModal()" class="btn-primary">اكتب أول قصة</button>' : 
                        '<button onclick="showModal(\'registerModal\')" class="btn-primary">سجل واكتب قصة</button>'
                    }
                </div>
            `;
        } else {
            let storiesHTML = '';
            
            querySnapshot.forEach((doc) => {
                const story = doc.data();
                storiesHTML += `
                    <div class="story-card">
                        <h3 class="story-title">${escapeHtml(story.title) || 'بدون عنوان'}</h3>
                        <p class="story-excerpt">${escapeHtml(story.content?.substring(0, 200) || '')}...</p>
                        <div class="story-meta">
                            <span><i class="fas fa-user"></i> ${escapeHtml(story.author) || 'مجهول'}</span>
                            <span><i class="fas fa-calendar"></i> ${formatDate(story.createdAt)}</span>
                        </div>
                    </div>
                `;
            });
            
            storiesContainer.innerHTML = storiesHTML;
            
            // تحديث العداد
            updateStoryCount(querySnapshot.size);
        }
    } catch (error) {
        console.error("❌ خطأ في تحميل القصص:", error);
        document.getElementById('stories-container').innerHTML = `
            <div class="error">
                <i class="fas fa-exclamation-triangle"></i>
                <p>حدث خطأ في تحميل القصص</p>
                <button onclick="loadStories()" class="btn-outline">حاول مرة أخرى</button>
            </div>
        `;
    }
}

// إضافة قصة جديدة
async function addNewStory() {
    if (!currentUser) {
        showMessage("⚠️ يجب تسجيل الدخول أولاً", "error");
        showModal('loginModal');
        return;
    }
    
    const title = prompt("✏️ عنوان القصة:");
    if (!title || title.trim().length < 3) {
        showMessage("⚠️ العنوان يجب أن يكون 3 أحرف على الأقل", "error");
        return;
    }
    
    const content = prompt("📝 محتوى القصة (اكتب بالدارجة المغربية):");
    if (!content || content.trim().length < 10) {
        showMessage("⚠️ المحتوى يجب أن يكون 10 أحرف على الأقل", "error");
        return;
    }
    
    const category = prompt("🏷️ التصنيف (رومانسية، كوميدية، دراما، إلخ):", "عام");
    
    try {
        await addDoc(collection(db, "stories"), {
            title: title.trim(),
            content: content.trim(),
            category: category || "عام",
            author: currentUser.email,
            authorId: currentUser.uid,
            createdAt: Timestamp.now(),
            views: 0,
            likes: 0,
            comments: 0
        });
        
        showMessage("✅ تم نشر قصتك بنجاح!", "success");
        loadStories(); // إعادة تحميل القائمة
    } catch (error) {
        console.error("❌ خطأ في نشر القصة:", error);
        showMessage("❌ حدث خطأ في نشر القصة", "error");
    }
}

// ==================== وظائف المساعدة ====================

// إعداد مستمعي الأحداث
function setupEventListeners() {
    // أزرار المصادقة
    document.getElementById('login-btn')?.addEventListener('click', () => showModal('loginModal'));
    document.getElementById('register-btn')?.addEventListener('click', () => showModal('registerModal'));
    document.getElementById('logout-btn')?.addEventListener('click', logoutUser);
    document.getElementById('add-story-btn')?.addEventListener('click', addNewStory);
    document.getElementById('start-writing')?.addEventListener('click', () => {
        if (currentUser) {
            addNewStory();
        } else {
            showModal('registerModal');
        }
    });
    document.getElementById('refresh-stories')?.addEventListener('click', loadStories);
    
    // تنفيذ الدخول
    document.getElementById('doLogin')?.addEventListener('click', () => {
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;
        loginUser(email, password);
    });
    
    // تنفيذ التسجيل
    document.getElementById('doRegister')?.addEventListener('click', () => {
        const email = document.getElementById('registerEmail').value;
        const password = document.getElementById('registerPassword').value;
        registerUser(email, password);
    });
    
    // إغلاق النوافذ
    document.querySelectorAll('.close-modal').forEach(closeBtn => {
        closeBtn.addEventListener('click', function() {
            const modal = this.closest('.modal');
            if (modal) {
                hideModal(modal.id);
            }
        });
    });
    
    // التبديل بين النوافذ
    document.getElementById('switch-to-register')?.addEventListener('click', (e) => {
        e.preventDefault();
        hideModal('loginModal');
        showModal('registerModal');
    });
    
    // إغلاق النوافذ عند النقر خارجها
    window.addEventListener('click', (event) => {
        if (event.target.classList.contains('modal')) {
            hideModal(event.target.id);
        }
    });
    
    // Enter للنماذج
    document.getElementById('loginEmail')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') document.getElementById('doLogin').click();
    });
    document.getElementById('loginPassword')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') document.getElementById('doLogin').click();
    });
    document.getElementById('registerEmail')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') document.getElementById('doRegister').click();
    });
    document.getElementById('registerPassword')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') document.getElementById('doRegister').click();
    });
}

// عرض وإخفاء النوافذ
function showModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'block';
        document.body.style.overflow = 'hidden';
    }
}

function hideModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
    }
}

// عرض حالة المستخدم
function showUserView(email) {
    document.getElementById('guest-view').style.display = 'none';
    document.getElementById('user-view').style.display = 'flex';
    document.getElementById('user-email').textContent = email;
}

function showGuestView() {
    document.getElementById('guest-view').style.display = 'block';
    document.getElementById('user-view').style.display = 'none';
}

// معالجة أخطاء المصادقة
function handleAuthError(error) {
    console.error("❌ خطأ في المصادقة:", error);
    
    switch (error.code) {
        case 'auth/email-already-in-use':
            showMessage("❌ هذا البريد الإلكتروني مستخدم بالفعل", "error");
            break;
        case 'auth/invalid-email':
            showMessage("❌ بريد إلكتروني غير صحيح", "error");
            break;
        case 'auth/weak-password':
            showMessage("❌ كلمة المرور ضعيفة جداً", "error");
            break;
        case 'auth/user-not-found':
            showMessage("❌ لا يوجد حساب بهذا البريد", "error");
            break;
        case 'auth/wrong-password':
            showMessage("❌ كلمة المرور غير صحيحة", "error");
            break;
        default:
            showMessage("❌ حدث خطأ: " + error.message, "error");
    }
}

// وظائف مساعدة
function updateCurrentYear() {
    document.getElementById('current-year').textContent = new Date().getFullYear();
}

function validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

function formatDate(timestamp) {
    if (!timestamp) return 'تاريخ غير معروف';
    try {
        const date = timestamp.toDate();
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);
        
        if (diffMins < 60) {
            return `قبل ${diffMins} دقيقة`;
        } else if (diffHours < 24) {
            return `قبل ${diffHours} ساعة`;
        } else if (diffDays < 7) {
            return `قبل ${diffDays} يوم`;
        } else {
            return date.toLocaleDateString('ar-MA');
        }
    } catch (e) {
        return 'تاريخ حديث';
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showMessage(message, type = 'info') {
    // يمكن تطويرها لعرض رسائل أكثر جمالاً
    alert(message);
}

function showLoading(show) {
    // يمكن تطويرها لعرض مؤشر تحميل
    if (show) {
        console.log("⏳ جاري المعالجة...");
    }
}

function clearForm(formId) {
    const form = document.getElementById(formId);
    if (form) {
        form.reset();
    }
}

function updateStoryCount(count) {
    const countElement = document.getElementById('stories-count');
    if (countElement) {
        countElement.textContent = count;
    }
}

// جعل الدوال متاحة عالمياً للنوافذ المنبثقة
window.showModal = showModal;
window.hideModal = hideModal;
window.loadStories = loadStories;
window.addNewStory = addNewStory;