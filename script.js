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
    query,
    where,
    orderBy,
    doc,
    getDoc,
    updateDoc,
    Timestamp 
} from './firebase-config.js';

// حالة التطبيق
let currentUser = null;

// متغيرات صفحة القصة
let currentStoryId = null;
let currentStoryLikes = 0;
let hasLiked = false;

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
        
        // ترتيب القصص حسب الأحدث
        const q = query(collection(db, "stories"), orderBy("createdAt", "desc"));
        const querySnapshot = await getDocs(q);
        
        if (querySnapshot.empty) {
            storiesContainer.innerHTML = `
                <div class="no-stories">
                    <i class="fas fa-book-open"></i>
                    <h3>لا توجد قصص بعد</h3>
                    <p>كن أول من يكتب قصة بالدارجة المغربية!</p>
                    ${currentUser ? 
                        '<button onclick="showStoryModal()" class="btn-primary">اكتب أول قصة</button>' : 
                        '<button onclick="showModal(\'registerModal\')" class="btn-primary">سجل واكتب قصة</button>'
                    }
                </div>
            `;
        } else {
            let storiesHTML = '';
            
            querySnapshot.forEach((doc) => {
                const story = doc.data();
                const storyId = doc.id;
                
                storiesHTML += `
                    <div class="story-card" onclick="showStoryDetail('${storyId}')" style="cursor: pointer;">
                        <div class="story-card-header">
                            <h3 class="story-title">${escapeHtml(story.title) || 'بدون عنوان'}</h3>
                            <span class="story-category-badge">${escapeHtml(story.category) || 'عام'}</span>
                        </div>
                        <p class="story-excerpt">${escapeHtml(story.content?.substring(0, 150) || '')}...</p>
                        <div class="story-card-footer">
                            <div class="story-meta">
                                <span><i class="fas fa-user"></i> ${escapeHtml(story.author) || 'مجهول'}</span>
                                <span><i class="fas fa-calendar"></i> ${formatDate(story.createdAt)}</span>
                            </div>
                            <div class="story-stats">
                                <span><i class="fas fa-eye"></i> ${story.views || 0}</span>
                                <span><i class="fas fa-heart"></i> ${story.likes || 0}</span>
                                <span><i class="fas fa-comment"></i> ${story.comments || 0}</span>
                            </div>
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

// إضافة قصة جديدة (نافذة منبثقة بسيطة)
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

// ==================== صفحة القصة الكاملة ====================

// عرض صفحة القصة الكاملة
async function showStoryDetail(storyId) {
    try {
        currentStoryId = storyId;
        
        // إخفاء الصفحة الرئيسية وإظهار صفحة القصة
        document.querySelector('main').style.display = 'none';
        document.getElementById('story-detail-page').style.display = 'block';
        
        // جلب بيانات القصة
        const storyRef = doc(db, "stories", storyId);
        const storySnap = await getDoc(storyRef);
        
        if (!storySnap.exists()) {
            showMessage("❌ القصة غير موجودة", "error");
            backToHome();
            return;
        }
        
        const story = storySnap.data();
        
        // عرض بيانات القصة
        document.getElementById('story-detail-title').textContent = story.title;
        document.getElementById('story-detail-content').textContent = story.content;
        document.getElementById('author-name').textContent = story.author;
        document.getElementById('story-date').textContent = formatDate(story.createdAt);
        document.getElementById('story-category').textContent = story.category;
        document.getElementById('story-views').textContent = (story.views || 0) + 1;
        document.getElementById('likes-count').textContent = story.likes || 0;
        
        currentStoryLikes = story.likes || 0;
        
        // تحميل التعليقات
        loadComments(storyId);
        
        // تفعيل زر الإعجاب
        setupLikeButton(storyId, story.likes || 0);
        
        // زيادة عدد المشاهدات
        await updateDoc(storyRef, {
            views: (story.views || 0) + 1
        });
        
        // إظهار نموذج التعليق فقط للمستخدمين المسجلين
        const commentForm = document.getElementById('add-comment-form');
        if (currentUser) {
            commentForm.style.display = 'block';
        } else {
            commentForm.style.display = 'none';
        }
        
    } catch (error) {
        console.error("❌ خطأ في تحميل القصة:", error);
        showMessage("❌ حدث خطأ في تحميل القصة", "error");
        backToHome();
    }
}

// العودة للصفحة الرئيسية
function backToHome() {
    document.querySelector('main').style.display = 'block';
    document.getElementById('story-detail-page').style.display = 'none';
    
    // إعادة تعيين المتغيرات
    currentStoryId = null;
    currentStoryLikes = 0;
    hasLiked = false;
}

// تفعيل زر الإعجاب
async function setupLikeButton(storyId, currentLikes) {
    const likeBtn = document.getElementById('like-story-btn');
    const likesCount = document.getElementById('likes-count');
    
    // التحقق إذا كان المستخدم قد أعجب بهذه القصة مسبقاً
    await checkIfUserLiked(storyId);
    
    likeBtn.onclick = async () => {
        if (!currentUser) {
            showMessage("⚠️ يجب تسجيل الدخول للإعجاب بالقصة", "error");
            return;
        }
        
        if (hasLiked) {
            showMessage("❤️ لقد أعجبت بهذه القصة مسبقاً", "info");
            return;
        }
        
        try {
            const storyRef = doc(db, "stories", storyId);
            
            // زيادة عدد الإعجابات
            await updateDoc(storyRef, {
                likes: currentLikes + 1
            });
            
            // تحديث الواجهة
            likesCount.textContent = currentLikes + 1;
            likeBtn.classList.add('liked');
            likeBtn.innerHTML = '<i class="fas fa-heart"></i> ممتع!';
            
            // تسجيل أن المستخدم أعجب بهذه القصة
            await addDoc(collection(db, "likes"), {
                storyId: storyId,
                userId: currentUser.uid,
                userEmail: currentUser.email,
                likedAt: Timestamp.now()
            });
            
            hasLiked = true;
            showMessage("❤️ شكراً لإعجابك بالقصة!", "success");
            
        } catch (error) {
            console.error("❌ خطأ في الإعجاب:", error);
            showMessage("❌ حدث خطأ في الإعجاب", "error");
        }
    };
}

// التحقق إذا كان المستخدم قد أعجب بالقصة مسبقاً
async function checkIfUserLiked(storyId) {
    if (!currentUser) return;
    
    try {
        const q = query(
            collection(db, "likes"),
            where("storyId", "==", storyId),
            where("userId", "==", currentUser.uid)
        );
        
        const querySnapshot = await getDocs(q);
        hasLiked = !querySnapshot.empty;
        
        if (hasLiked) {
            const likeBtn = document.getElementById('like-story-btn');
            likeBtn.classList.add('liked');
            likeBtn.innerHTML = '<i class="fas fa-heart"></i> معجب بالفعل';
        }
    } catch (error) {
        console.error("❌ خطأ في التحقق من الإعجاب:", error);
    }
}

// تحميل التعليقات
async function loadComments(storyId) {
    const commentsList = document.getElementById('comments-list');
    const commentsCount = document.getElementById('comments-count');
    
    // عرض حالة التحميل
    commentsList.innerHTML = `
        <div class="loading-comments">
            <i class="fas fa-spinner fa-spin"></i>
            <p>جاري تحميل التعليقات...</p>
        </div>
    `;
    
    try {
        const q = query(
            collection(db, "comments"),
            where("storyId", "==", storyId),
            orderBy("createdAt", "desc")
        );
        
        const querySnapshot = await getDocs(q);
        
        // تحديث عدد التعليقات
        commentsCount.textContent = querySnapshot.size;
        
        if (querySnapshot.empty) {
            commentsList.innerHTML = `
                <div class="no-comments">
                    <i class="fas fa-comment-slash"></i>
                    <p>لا توجد تعليقات بعد. كن أول من يعلق!</p>
                </div>
            `;
        } else {
            let commentsHTML = '';
            
            querySnapshot.forEach((doc) => {
                const comment = doc.data();
                commentsHTML += `
                    <div class="comment-item">
                        <div class="comment-header">
                            <div class="comment-author">
                                <i class="fas fa-user-circle"></i>
                                ${comment.author || 'مستخدم'}
                            </div>
                            <div class="comment-date">
                                ${formatDate(comment.createdAt)}
                            </div>
                        </div>
                        <div class="comment-content">
                            ${escapeHtml(comment.text)}
                        </div>
                    </div>
                `;
            });
            
            commentsList.innerHTML = commentsHTML;
        }
        
    } catch (error) {
        console.error("❌ خطأ في تحميل التعليقات:", error);
        commentsList.innerHTML = `
            <div class="error-comments">
                <i class="fas fa-exclamation-triangle"></i>
                <p>حدث خطأ في تحميل التعليقات</p>
            </div>
        `;
    }
}

// إضافة تعليق جديد
async function addComment(storyId, commentText) {
    if (!currentUser) {
        showMessage("⚠️ يجب تسجيل الدخول لإضافة تعليق", "error");
        return;
    }
    
    if (!commentText.trim()) {
        showMessage("⚠️ يرجى كتابة تعليق", "error");
        return;
    }
    
    try {
        // حفظ التعليق في قاعدة البيانات
        await addDoc(collection(db, "comments"), {
            storyId: storyId,
            text: commentText,
            author: currentUser.email,
            authorId: currentUser.uid,
            createdAt: Timestamp.now()
        });
        
        // تحديث عدد التعليقات في القصة
        const storyRef = doc(db, "stories", storyId);
        const storySnap = await getDoc(storyRef);
        
        if (storySnap.exists()) {
            const story = storySnap.data();
            await updateDoc(storyRef, {
                comments: (story.comments || 0) + 1
            });
        }
        
        // إعادة تحميل التعليقات
        loadComments(storyId);
        
        // مسح حقل التعليق
        document.getElementById('comment-text').value = '';
        
        showMessage("✅ تم إضافة تعليقك بنجاح", "success");
        
    } catch (error) {
        console.error("❌ خطأ في إضافة التعليق:", error);
        showMessage("❌ حدث خطأ في إضافة التعليق", "error");
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
    
    // زر العودة للرئيسية
    document.getElementById('back-to-home')?.addEventListener('click', backToHome);
    
    // إرسال تعليق
    document.getElementById('add-comment-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const commentText = document.getElementById('comment-text').value;
        
        if (currentStoryId && commentText.trim()) {
            await addComment(currentStoryId, commentText);
        }
    });
    
    // عند تحميل الصفحة، التحقق إذا كان هناك story ID في الرابط
    const urlParams = new URLSearchParams(window.location.search);
    const storyIdFromUrl = urlParams.get('story');
    if (storyIdFromUrl) {
        // تأخير قليل لضمان تحميل الصفحة أولاً
        setTimeout(() => {
            showStoryDetail(storyIdFromUrl);
        }, 500);
    }
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
           