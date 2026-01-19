// script.js - النسخة النهائية الكاملة مع إصلاح التبديل بين الصفحات
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
    deleteDoc,
    Timestamp 
} from './firebase-config.js';

// حالة التطبيق
let currentUser = null;

// متغيرات صفحة القصة
let currentStoryId = null;
let currentStoryLikes = 0;
let hasLiked = false;

// نظام الوضع الداكن/الفاتح
let currentTheme = localStorage.getItem('theme') || 'light';

// نظام الأجزاء المتعددة
let currentStoryParts = [];
let currentPartIndex = 0;

// ==================== نظام التحكم بالصفحات ====================
let isStoryPageActive = false;

// ==================== نظام Toast Notifications ====================
function showToast(message, type = 'info') {
    // إزالة أي toast قديم
    const oldToast = document.querySelector('.toast');
    if (oldToast) oldToast.remove();
    
    // إنشاء toast جديد
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    // أيقونة مناسبة
    let icon = 'info-circle';
    if (type === 'success') icon = 'check-circle';
    if (type === 'error') icon = 'exclamation-circle';
    if (type === 'warning') icon = 'exclamation-triangle';
    
    toast.innerHTML = `
        <i class="fas fa-${icon}"></i>
        <span>${message}</span>
    `;
    
    document.body.appendChild(toast);
    
    // إزالة بعد 4 ثوان
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// ==================== عند تحميل الصفحة ====================
document.addEventListener('DOMContentLoaded', function() {
    console.log("🚀 9esati جاهز للتشغيل!");
    
    // تطبيق الوضع المحفوظ
    applyTheme(currentTheme);
    
    // تحديث السنة في الفوتر
    updateCurrentYear();
    
    // إعداد مستمعي الأحداث
    setupEventListeners();
    
    // مراقبة حالة المصادقة
    setupAuthListener();
    
    // تحميل القصص عند البدء
    loadStories();
    
    // إعداد أحداث الصفحة
    setupPageEvents();
});

// ==================== نظام الوضع الداكن/الفاتح ====================
function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
    updateThemeButton(theme);
}

function updateThemeButton(theme) {
    const themeBtn = document.getElementById('theme-toggle-btn');
    if (!themeBtn) return;
    
    const themeIcon = themeBtn.querySelector('i');
    const themeText = themeBtn.querySelector('.theme-text');
    
    if (theme === 'dark') {
        themeIcon.className = 'fas fa-sun';
        themeText.textContent = 'فاتح';
    } else {
        themeIcon.className = 'fas fa-moon';
        themeText.textContent = 'داكن';
    }
}

function toggleTheme() {
    currentTheme = currentTheme === 'light' ? 'dark' : 'light';
    applyTheme(currentTheme);
}

function setupThemeToggle() {
    const themeBtn = document.getElementById('theme-toggle-btn');
    if (themeBtn) {
        themeBtn.addEventListener('click', toggleTheme);
    }
}

// ==================== وظائف المصادقة ====================
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

async function registerUser(email, password) {
    if (!validateEmail(email)) {
        showToast("⚠️ يرجى إدخال بريد إلكتروني صحيح", "error");
        return;
    }
    
    if (password.length < 6) {
        showToast("⚠️ كلمة المرور يجب أن تكون 6 أحرف على الأقل", "error");
        return;
    }
    
    try {
        showLoading(true);
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        
        // إنشاء بيانات المستخدم في Firestore
        await addDoc(collection(db, "users"), {
            uid: userCredential.user.uid,
            email: email,
            createdAt: Timestamp.now(),
            role: "user"
        });
        
        showToast(`🎉 مرحباً ${email}! تم إنشاء حسابك بنجاح`, "success");
        hideModal('registerModal');
        clearForm('registerModal');
    } catch (error) {
        handleAuthError(error);
    } finally {
        showLoading(false);
    }
}

async function loginUser(email, password) {
    if (!email || !password) {
        showToast("⚠️ يرجى ملء جميع الحقول", "error");
        return;
    }
    
    try {
        showLoading(true);
        await signInWithEmailAndPassword(auth, email, password);
        showToast(`👋 أهلاً بعودتك ${email}!`, "success");
        hideModal('loginModal');
        clearForm('loginModal');
    } catch (error) {
        handleAuthError(error);
    } finally {
        showLoading(false);
    }
}

async function logoutUser() {
    try {
        await signOut(auth);
        showToast("✅ تم تسجيل الخروج بنجاح", "success");
    } catch (error) {
        showToast("❌ خطأ في تسجيل الخروج", "error");
    }
}

// ==================== وظائف القصص ====================
async function loadStories() {
    try {
        const storiesContainer = document.getElementById('stories-container');
        if (!storiesContainer) return;
        
        storiesContainer.innerHTML = `
            <div class="loading">
                <i class="fas fa-spinner fa-spin"></i>
                <p>جاري تحميل القصص...</p>
            </div>
        `;
        
        // استعلام بسيط بدون مركب - لا يحتاج Index
        const q = query(collection(db, "stories"), orderBy("createdAt", "desc"));
        const querySnapshot = await getDocs(q);
        
        if (querySnapshot.empty) {
            storiesContainer.innerHTML = `
                <div class="no-stories">
                    <i class="fas fa-book-open"></i>
                    <h3>لا توجد قصص بعد</h3>
                    <p>كن أول من يكتب قصة بالدارجة المغربية!</p>
                    ${currentUser ? 
                        '<button onclick="openAddStoryModal()" class="btn-primary">اكتب أول قصة</button>' : 
                        '<button onclick="showModal(\'registerModal\')" class="btn-primary">سجل واكتب قصة</button>'
                    }
                </div>
            `;
        } else {
            let storiesHTML = '';
            
            querySnapshot.forEach((doc) => {
                const story = doc.data();
                const storyId = doc.id;
                const isMultiPart = story.isMultiPart || false;
                const totalParts = story.totalParts || 1;
                const currentPart = story.currentPart || 1;
                
                // أزرار الإجراءات (تظهر فقط لصاحب القصة)
                const actionButtons = currentUser && story.authorId === currentUser.uid ? `
                    <div class="story-actions" onclick="event.stopPropagation();">
                        <button onclick="editStoryPrompt('${storyId}')" class="btn-edit-small" title="تعديل العنوان">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button onclick="deleteStoryPrompt('${storyId}')" class="btn-delete-small" title="حذف">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                ` : '';
                
                storiesHTML += `
                    <div class="story-card" onclick="safeShowStoryDetail('${storyId}')">
                        <div class="story-card-header">
                            <div style="cursor: pointer; flex-grow: 1;">
                                <h3 class="story-title">${escapeHtml(story.title) || 'بدون عنوان'}</h3>
                                ${isMultiPart ? 
                                    `<span class="multi-part-badge">
                                        <i class="fas fa-layer-group"></i>
                                        ${currentPart}/${totalParts} جزء
                                    </span>` : 
                                    ''
                                }
                            </div>
                            <div class="story-header-right">
                                <span class="story-category-badge">${escapeHtml(story.category) || 'عام'}</span>
                                ${actionButtons}
                            </div>
                        </div>
                        <p class="story-excerpt" style="cursor: pointer;">
                            ${escapeHtml(story.content?.substring(0, 150) || '')}...
                        </p>
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

// ==================== إضافة قصة جديدة ====================
function openAddStoryModal() {
    if (!currentUser) {
        showToast("⚠️ يجب تسجيل الدخول أولاً", "error");
        showModal('loginModal');
        return;
    }
    
    // HTML للنافذة المنبثقة
    const modalHTML = `
        <div id="addStoryModal" class="modal" style="display: block;">
            <div class="modal-content" style="max-width: 600px;">
                <span class="close-modal" onclick="hideModal('addStoryModal')">&times;</span>
                <h2><i class="fas fa-pen"></i> قصة جديدة</h2>
                
                <div class="form-group">
                    <input type="text" id="newStoryTitle" placeholder="عنوان القصة" required>
                </div>
                
                <div class="form-group">
                    <select id="newStoryCategory">
                        <option value="عام">عام</option>
                        <option value="رومانسية">رومانسية 💖</option>
                        <option value="كوميدية">كوميدية 😄</option>
                        <option value="دراما">دراما 🎭</option>
                        <option value="رعب">رعب 👻</option>
                        <option value="خيال علمي">خيال علمي 🚀</option>
                        <option value="واقعية">واقعية 📖</option>
                        <option value="تاريخية">تاريخية 🏰</option>
                        <option value="مغامرات">مغامرات ⚔️</option>
                        <option value="أسرة">أسرة 👨‍👩‍👧‍👦</option>
                        <option value="اجتماعية">اجتماعية 👥</option>
                    </select>
                </div>
                
                <div class="form-group">
                    <textarea id="newStoryContent" 
                              placeholder="اكتب قصتك هنا بالدارجة المغربية..." 
                              rows="8" required></textarea>
                    <div class="char-count">عدد الأحرف: <span id="charCount">0</span></div>
                </div>
                
                <div class="modal-actions">
                    <button onclick="hideModal('addStoryModal')" class="btn-outline">إلغاء</button>
                    <button onclick="publishNewStory()" class="btn-primary">نشر القصة</button>
                </div>
            </div>
        </div>
    `;
    
    // إضافة النافذة للصفحة
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    // إعداد عداد الأحرف
    const contentInput = document.getElementById('newStoryContent');
    if (contentInput) {
        contentInput.addEventListener('input', function() {
            document.getElementById('charCount').textContent = this.value.length;
        });
    }
}

// نشر القصة الجديدة
async function publishNewStory() {
    if (!currentUser) {
        showToast("⚠️ يجب تسجيل الدخول أولاً", "error");
        return;
    }
    
    const title = document.getElementById('newStoryTitle')?.value.trim();
    const content = document.getElementById('newStoryContent')?.value.trim();
    const category = document.getElementById('newStoryCategory')?.value || "عام";
    
    // التحقق من المدخلات
    if (!title || title.length < 3) {
        showToast("⚠️ العنوان يجب أن يكون 3 أحرف على الأقل", "error");
        return;
    }
    
    if (!content || content.length < 10) {
        showToast("⚠️ المحتوى يجب أن يكون 10 أحرف على الأقل", "error");
        return;
    }
    
    try {
        showLoading(true);
        
        // إضافة القصة مع authorId (مهم للأمان!)
        await addDoc(collection(db, "stories"), {
            title: title,
            content: content,
            category: category,
            author: currentUser.email,
            authorId: currentUser.uid,  // ⬅️ مهم للأمان
            createdAt: Timestamp.now(),
            views: 0,
            likes: 0,
            comments: 0,
            isMultiPart: false,
            totalParts: 1,
            currentPart: 1,
            status: "published"
        });
        
        showToast(`✅ تم نشر قصتك "${title}" بنجاح!`, "success");
        hideModal('addStoryModal');
        loadStories();
        
    } catch (error) {
        console.error("❌ خطأ في نشر القصة:", error);
        showToast("❌ حدث خطأ في نشر القصة", "error");
    } finally {
        showLoading(false);
    }
}

// ==================== وظائف التعديل والحذف ====================

// تعديل عنوان القصة (بسيط)
async function editStoryPrompt(storyId) {
    if (!currentUser) {
        showToast("⚠️ يجب تسجيل الدخول", "error");
        return;
    }
    
    const newTitle = prompt("✏️ العنوان الجديد للقصة:");
    if (!newTitle || newTitle.trim().length < 3) {
        showToast("⚠️ العنوان يجب أن يكون 3 أحرف على الأقل", "error");
        return;
    }
    
    try {
        // 1. جلب القصة للتحقق من الملكية
        const storyRef = doc(db, "stories", storyId);
        const storySnap = await getDoc(storyRef);
        
        if (!storySnap.exists()) {
            showToast("❌ القصة غير موجودة", "error");
            return;
        }
        
        const story = storySnap.data();
        
        // 2. التحقق إذا كان المستخدم هو صاحب القصة
        if (story.authorId !== currentUser.uid) {
            showToast("⚠️ ليس لديك صلاحية تعديل هذه القصة", "error");
            return;
        }
        
        // 3. التعديل
        await updateDoc(storyRef, {
            title: newTitle.trim(),
            updatedAt: Timestamp.now()
        });
        
        showToast("✅ تم تعديل القصة بنجاح", "success");
        loadStories();
        
    } catch (error) {
        console.error("❌ خطأ في التعديل:", error);
        showToast("❌ حدث خطأ في التعديل", "error");
    }
}

// حذف القصة
async function deleteStoryPrompt(storyId) {
    if (!currentUser) {
        showToast("⚠️ يجب تسجيل الدخول", "error");
        return;
    }
    
    // تأكيد الحذف
    if (!confirm("⚠️ هل أنت متأكد من حذف هذه القصة؟\n\nهذا الإجراء لا يمكن التراجع عنه.")) {
        return;
    }
    
    try {
        // 1. جلب القصة للتحقق من الملكية
        const storyRef = doc(db, "stories", storyId);
        const storySnap = await getDoc(storyRef);
        
        if (!storySnap.exists()) {
            showToast("❌ القصة غير موجودة", "error");
            return;
        }
        
        const story = storySnap.data();
        
        // 2. التحقق إذا كان المستخدم هو صاحب القصة
        if (story.authorId !== currentUser.uid) {
            showToast("⚠️ ليس لديك صلاحية حذف هذه القصة", "error");
            return;
        }
        
        // 3. الحذف
        await deleteDoc(storyRef);
        
        showToast("✅ تم حذف القصة بنجاح", "success");
        
        // 4. إذا كنا في صفحة القصة، العودة للرئيسية
        if (currentStoryId === storyId) {
            backToHome();
        }
        
        // 5. إعادة تحميل القصص
        loadStories();
        
    } catch (error) {
        console.error("❌ خطأ في الحذف:", error);
        showToast("❌ حدث خطأ في الحذف", "error");
    }
}

// ==================== نظام التحكم بالصفحات ====================
function showHomePage() {
    const mainContent = document.querySelector('main');
    const storyPage = document.getElementById('story-detail-page');
    
    if (mainContent) {
        mainContent.style.display = 'block';
        mainContent.style.visibility = 'visible';
    }
    
    if (storyPage) {
        storyPage.style.display = 'none';
        storyPage.style.visibility = 'hidden';
    }
    
    isStoryPageActive = false;
    console.log("🏠 الصفحة الرئيسية ظاهرة");
}

function showStoryPage() {
    const mainContent = document.querySelector('main');
    const storyPage = document.getElementById('story-detail-page');
    
    if (mainContent) {
        mainContent.style.display = 'none';
        mainContent.style.visibility = 'hidden';
    }
    
    if (storyPage) {
        storyPage.style.display = 'block';
        storyPage.style.visibility = 'visible';
        
        // تأكد من أن الصفحة مكتملة التحميل
        setTimeout(() => {
            storyPage.style.opacity = '1';
        }, 10);
    }
    
    isStoryPageActive = true;
    console.log("📖 صفحة القصة ظاهرة");
}

// ==================== العودة للرئيسية ====================
function backToHome() {
    console.log("🏠 العودة للرئيسية...");
    
    // إظهار الصفحة الرئيسية وإخفاء صفحة القصة
    showHomePage();
    
    // إعادة تعيين المتغيرات
    currentStoryId = null;
    currentStoryLikes = 0;
    hasLiked = false;
    currentStoryParts = [];
    currentPartIndex = 0;
    
    // تحديث URL إذا كان يحتوي على story
    if (window.location.search.includes('story=')) {
        const newUrl = window.location.pathname;
        window.history.pushState({ page: 'home' }, '', newUrl);
    }
    
    // إعادة تحميل القصص لتحديثها
    setTimeout(() => {
        loadStories();
    }, 100);
    
    console.log("✅ تم العودة للرئيسية بنجاح");
}

// ==================== دالة آمنة لتحميل القصة ====================
async function safeShowStoryDetail(storyId) {
    console.log("🔒 تحميل آمن للقصة:", storyId);
    
    // انتظر قليلاً لضمان اكتمال العمليات السابقة
    await new Promise(resolve => setTimeout(resolve, 50));
    
    try {
        // أولاً: إظهار صفحة القصة
        showStoryPage();
        
        // ثانياً: انتظر حتى تظهر الصفحة
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // ثالثاً: تحميل القصة
        await loadStoryContent(storyId);
        
    } catch (error) {
        console.error("❌ خطأ في safeShowStoryDetail:", error);
        showToast("❌ حدث خطأ في تحميل القصة", "error");
        backToHome();
    }
}

// ==================== تحميل محتوى القصة ====================
async function loadStoryContent(storyId) {
    try {
        console.log("📖 جاري تحميل محتوى القصة:", storyId);
        
        // التحقق من أن صفحة القصة ظاهرة
        const storyPage = document.getElementById('story-detail-page');
        if (!storyPage || storyPage.style.display === 'none') {
            console.error("❌ صفحة القصة غير ظاهرة");
            return;
        }
        
        // جلب بيانات القصة
        const storyRef = doc(db, "stories", storyId);
        const storySnap = await getDoc(storyRef);
        
        if (!storySnap.exists()) {
            showToast("❌ القصة غير موجودة", "error");
            backToHome();
            return;
        }
        
        const story = storySnap.data();
        
        // دالة آمنة لتعيين النصوص
        function safeSetText(elementId, text) {
            try {
                const element = document.getElementById(elementId);
                if (element) {
                    element.textContent = text;
                    return true;
                } else {
                    console.warn(`⚠️ العنصر غير موجود: ${elementId}`);
                    return false;
                }
            } catch (error) {
                console.error(`❌ خطأ في تعيين ${elementId}:`, error);
                return false;
            }
        }
        
        // تعيين بيانات القصة
        safeSetText('story-detail-title', story.title || 'بدون عنوان');
        safeSetText('author-name', story.author || 'مجهول');
        safeSetText('story-date', formatDate(story.createdAt));
        safeSetText('story-category', story.category || 'عام');
        safeSetText('story-views', (story.views || 0) + 1);
        safeSetText('likes-count', story.likes || 0);
        
        // تحديث المتغيرات
        currentStoryId = storyId;
        currentStoryLikes = story.likes || 0;
        
        // عرض محتوى القصة
        const storyContent = document.getElementById('story-detail-content');
        if (storyContent) {
            if (story.isMultiPart) {
                currentStoryParts = extractStoryParts(story.content);
                setupPartsNavigation(story.totalParts || 1);
                displayCurrentPart();
            } else {
                storyContent.textContent = story.content || '';
                const partsNav = document.getElementById('parts-navigation');
                if (partsNav) partsNav.style.display = 'none';
            }
        }
        
        // تحميل التعليقات
        loadCommentsSafe(storyId);
        
        // تفعيل زر الإعجاب
        setupLikeButton(storyId, story.likes || 0);
        
        // إعداد حماية النسخ
        setupCopyProtection();
        
        // زيادة المشاهدات
        try {
            await updateDoc(storyRef, {
                views: (story.views || 0) + 1
            });
        } catch (error) {
            console.log("⚠️ خطأ في تحديث المشاهدات:", error);
        }
        
        // تحديث URL
        const newUrl = `${window.location.pathname}?story=${storyId}`;
        window.history.pushState({ storyId: storyId, page: 'story' }, '', newUrl);
        
        // إظهار أزرار التعديل والحذف لصاحب القصة
        const storyActions = document.querySelector('.story-actions-detail');
        if (storyActions && currentUser && story.authorId === currentUser.uid) {
            // تنظيف الأزرار السابقة
            const existingButtons = storyActions.querySelectorAll('.btn-edit, .btn-delete');
            existingButtons.forEach(btn => btn.remove());
            
            // إضافة الأزرار الجديدة
            storyActions.innerHTML += `
                <button class="btn-edit" onclick="editStoryPrompt('${storyId}')" title="تعديل">
                    <i class="fas fa-edit"></i> تعديل
                </button>
                <button class="btn-delete" onclick="deleteStoryPrompt('${storyId}')" title="حذف">
                    <i class="fas fa-trash"></i> حذف
                </button>
            `;
        }
        
        // إظهار نموذج التعليق فقط للمستخدمين المسجلين
        const commentForm = document.getElementById('add-comment-form');
        if (commentForm) {
            commentForm.style.display = currentUser ? 'block' : 'none';
        }
        
        console.log("✅ تم تحميل القصة بنجاح");
        
    } catch (error) {
        console.error("❌ خطأ في loadStoryContent:", error);
        throw error;
    }
}

// استخراج الأجزاء من محتوى القصة
function extractStoryParts(content) {
    const parts = [];
    const partRegex = /\[الجزء (\d+)\]([\s\S]*?)(?=\[الجزء \d+\]|$)/g;
    let match;
    
    while ((match = partRegex.exec(content)) !== null) {
        const partNumber = parseInt(match[1]);
        const partContent = match[2].trim();
        parts.push({
            number: partNumber,
            content: partContent
        });
    }
    
    if (parts.length === 0 && content.trim()) {
        parts.push({
            number: 1,
            content: content.trim()
        });
    }
    
    return parts.sort((a, b) => a.number - b.number);
}

// إعداد تنقل الأجزاء
function setupPartsNavigation(totalParts) {
    const partsNav = document.getElementById('parts-navigation');
    const prevBtn = document.getElementById('prev-part-btn');
    const nextBtn = document.getElementById('next-part-btn');
    
    if (!partsNav || currentStoryParts.length <= 1) {
        if (partsNav) partsNav.style.display = 'none';
        return;
    }
    
    partsNav.style.display = 'flex';
    updatePartsIndicator();
    
    prevBtn.onclick = () => {
        if (currentPartIndex > 0) {
            currentPartIndex--;
            displayCurrentPart();
            updatePartsNavigation();
        }
    };
    
    nextBtn.onclick = () => {
        if (currentPartIndex < currentStoryParts.length - 1) {
            currentPartIndex++;
            displayCurrentPart();
            updatePartsNavigation();
        }
    };
}

function updatePartsNavigation() {
    const prevBtn = document.getElementById('prev-part-btn');
    const nextBtn = document.getElementById('next-part-btn');
    
    if (prevBtn) prevBtn.disabled = currentPartIndex === 0;
    if (nextBtn) nextBtn.disabled = currentPartIndex === currentStoryParts.length - 1;
    
    updatePartsIndicator();
}

function updatePartsIndicator() {
    const currentPartSpan = document.getElementById('current-part');
    const totalPartsSpan = document.getElementById('total-parts');
    
    if (currentPartSpan) {
        currentPartSpan.textContent = currentStoryParts[currentPartIndex]?.number || 1;
    }
    if (totalPartsSpan) {
        totalPartsSpan.textContent = currentStoryParts.length;
    }
}

function displayCurrentPart() {
    const storyContent = document.getElementById('story-detail-content');
    
    if (storyContent && currentStoryParts.length > 0) {
        const currentPart = currentStoryParts[currentPartIndex];
        storyContent.textContent = currentPart.content;
    }
    
    updatePartsNavigation();
}

// ==================== نظام الإعجابات ====================
async function setupLikeButton(storyId, currentLikes) {
    const likeBtn = document.getElementById('like-story-btn');
    const likesCount = document.getElementById('likes-count');
    
    if (!likeBtn || !likesCount) return;
    
    await checkIfUserLiked(storyId);
    
    likeBtn.onclick = async () => {
        if (!currentUser) {
            showToast("⚠️ يجب تسجيل الدخول للإعجاب بالقصة", "error");
            return;
        }
        
        if (hasLiked) {
            showToast("❤️ لقد أعجبت بهذه القصة مسبقاً", "info");
            return;
        }
        
        try {
            const storyRef = doc(db, "stories", storyId);
            
            await updateDoc(storyRef, {
                likes: currentLikes + 1
            });
            
            likesCount.textContent = currentLikes + 1;
            likeBtn.classList.add('liked');
            likeBtn.innerHTML = '<i class="fas fa-heart"></i> ممتع!';
            
            // تسجيل الإعجاب مع userId للأمان
            await addDoc(collection(db, "likes"), {
                storyId: storyId,
                userId: currentUser.uid,  // ⬅️ مهم للأمان
                userEmail: currentUser.email,
                likedAt: Timestamp.now()
            });
            
            hasLiked = true;
            showToast("❤️ شكراً لإعجابك بالقصة!", "success");
            
        } catch (error) {
            console.error("❌ خطأ في الإعجاب:", error);
            showToast("❌ حدث خطأ في الإعجاب", "error");
        }
    };
}

async function checkIfUserLiked(storyId) {
    if (!currentUser) return;
    
    try {
        // استعلام بسيط بدون مركب
        const likesRef = collection(db, "likes");
        const querySnapshot = await getDocs(likesRef);
        
        hasLiked = false;
        querySnapshot.forEach((doc) => {
            const like = doc.data();
            if (like.storyId === storyId && like.userId === currentUser.uid) {
                hasLiked = true;
            }
        });
        
        if (hasLiked) {
            const likeBtn = document.getElementById('like-story-btn');
            if (likeBtn) {
                likeBtn.classList.add('liked');
                likeBtn.innerHTML = '<i class="fas fa-heart"></i> معجب بالفعل';
            }
        }
    } catch (error) {
        console.error("❌ خطأ في التحقق من الإعجاب:", error);
    }
}

// ==================== حماية منع النسخ ====================
function setupCopyProtection() {
    const storyContent = document.getElementById('story-detail-content');
    
    if (!storyContent) return;
    
    // منع النقر الأيمن
    storyContent.addEventListener('contextmenu', function(e) {
        e.preventDefault();
        showToast("لا يسمح بنسخ محتوى القصة", "warning");
        return false;
    });
    
    // منع السحب للنص
    storyContent.addEventListener('selectstart', function(e) {
        e.preventDefault();
        return false;
    });
    
    // منع اختصارات النسخ
    document.addEventListener('keydown', function(e) {
        if ((e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'x')) {
            if (storyContent.contains(document.activeElement)) {
                e.preventDefault();
                showToast("المحتوى محمي من النسخ", "warning");
                return false;
            }
        }
    });
}

// ==================== نظام التعليقات المعدل ====================
async function loadCommentsSafe(storyId) {
    try {
        console.log("📝 تحميل تعليقات القصة:", storyId);
        
        // المحاولة الأولى: مع orderBy (إذا كان الـ Index موجوداً)
        try {
            const q = query(
                collection(db, "comments"),
                where("storyId", "==", storyId),
                orderBy("createdAt", "desc")
            );
            
            const querySnapshot = await getDocs(q);
            displayComments(querySnapshot);
            return;
        } catch (orderByError) {
            console.log("⚠️ فشل الاستعلام مع orderBy، جاري البديل...", orderByError.message);
        }
        
        // المحاولة الثانية: بدون orderBy (لا يحتاج Index)
        const q = query(
            collection(db, "comments"),
            where("storyId", "==", storyId)
        );
        
        const querySnapshot = await getDocs(q);
        
        // تحويل إلى مصفوفة وترتيب يدوياً
        const comments = [];
        querySnapshot.forEach(doc => {
            comments.push({ id: doc.id, ...doc.data() });
        });
        
        // ترتيب حسب التاريخ (الأحدث أولاً)
        comments.sort((a, b) => {
            const timeA = a.createdAt?.seconds || 0;
            const timeB = b.createdAt?.seconds || 0;
            return timeB - timeA; // ترتيب تنازلي
        });
        
        displayCommentsManual(comments);
        
    } catch (error) {
        console.error("❌ خطأ في تحميل التعليقات:", error);
        showCommentsErrorState();
    }
}

// عرض التعليقات من استعلام عادي
function displayComments(querySnapshot) {
    const commentsList = document.getElementById('comments-list');
    const commentsCount = document.getElementById('comments-count');
    
    if (!commentsList || !commentsCount) return;
    
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
            commentsHTML += createCommentHTML(doc.id, comment);
        });
        commentsList.innerHTML = commentsHTML;
    }
}

// عرض التعليقات من مصفوفة مرتبة يدوياً
function displayCommentsManual(comments) {
    const commentsList = document.getElementById('comments-list');
    const commentsCount = document.getElementById('comments-count');
    
    if (!commentsList || !commentsCount) return;
    
    commentsCount.textContent = comments.length;
    
    if (comments.length === 0) {
        commentsList.innerHTML = `
            <div class="no-comments">
                <i class="fas fa-comment-slash"></i>
                <p>لا توجد تعليقات بعد. كن أول من يعلق!</p>
            </div>
        `;
    } else {
        let commentsHTML = '';
        comments.forEach(comment => {
            commentsHTML += createCommentHTML(comment.id, comment);
        });
        commentsList.innerHTML = commentsHTML;
    }
}

// إنشاء HTML للتعليق
function createCommentHTML(commentId, comment) {
    const commentActions = currentUser && comment.authorId === currentUser.uid ? `
        <div class="comment-actions">
            <button onclick="deleteCommentSafe('${commentId}', '${currentStoryId}')" class="btn-delete-small" title="حذف">
                <i class="fas fa-trash"></i>
            </button>
        </div>
    ` : '';
    
    return `
        <div class="comment-item">
            <div class="comment-header">
                <div class="comment-author">
                    <i class="fas fa-user-circle"></i>
                    ${comment.author || 'مستخدم'}
                </div>
                <div class="comment-info">
                    <div class="comment-date">
                        ${formatDate(comment.createdAt)}
                    </div>
                    ${commentActions}
                </div>
            </div>
            <div class="comment-content">
                ${escapeHtml(comment.text)}
            </div>
        </div>
    `;
}

// حالة الخطأ
function showCommentsErrorState() {
    const commentsList = document.getElementById('comments-list');
    if (!commentsList) return;
    
    commentsList.innerHTML = `
        <div class="error-comments">
            <i class="fas fa-exclamation-triangle"></i>
            <p>حدث خطأ في تحميل التعليقات</p>
            <button onclick="loadCommentsSafe('${currentStoryId}')" class="btn-outline">
                <i class="fas fa-redo"></i> حاول مرة أخرى
            </button>
        </div>
    `;
}

// إضافة تعليق جديد
async function addComment(storyId, commentText) {
    if (!currentUser) {
        showToast("⚠️ يجب تسجيل الدخول لإضافة تعليق", "error");
        return;
    }
    
    if (!commentText.trim()) {
        showToast("⚠️ يرجى كتابة تعليق", "error");
        return;
    }
    
    try {
        // حفظ التعليق مع authorId
        await addDoc(collection(db, "comments"), {
            storyId: storyId,
            text: commentText,
            author: currentUser.email,
            authorId: currentUser.uid,  // ⬅️ مهم للأمان
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
        loadCommentsSafe(storyId);
        
        // مسح حقل التعليق
        const commentInput = document.getElementById('comment-text');
        if (commentInput) commentInput.value = '';
        
        showToast("✅ تم إضافة تعليقك بنجاح", "success");
        
    } catch (error) {
        console.error("❌ خطأ في إضافة التعليق:", error);
        showToast("❌ حدث خطأ في إضافة التعليق", "error");
    }
}

// حذف تعليق آمن
async function deleteCommentSafe(commentId, storyId) {
    if (!currentUser) return;
    
    if (!confirm("⚠️ هل تريد حذف هذا التعليق؟")) {
        return;
    }
    
    try {
        // التحقق من الملكية
        const commentRef = doc(db, "comments", commentId);
        const commentSnap = await getDoc(commentRef);
        
        if (!commentSnap.exists()) {
            showToast("❌ التعليق غير موجود", "error");
            return;
        }
        
        const comment = commentSnap.data();
        
        if (comment.authorId !== currentUser.uid) {
            showToast("⚠️ ليس لديك صلاحية حذف هذا التعليق", "error");
            return;
        }
        
        // حذف التعليق
        await deleteDoc(commentRef);
        
        // تحديث عدد التعليقات في القصة
        const storyRef = doc(db, "stories", storyId);
        const storySnap = await getDoc(storyRef);
        
        if (storySnap.exists()) {
            const story = storySnap.data();
            await updateDoc(storyRef, {
                comments: Math.max((story.comments || 1) - 1, 0)
            });
        }
        
        showToast("✅ تم حذف التعليق", "success");
        loadCommentsSafe(storyId);
        
    } catch (error) {
        console.error("❌ خطأ في حذف التعليق:", error);
        showToast("❌ حدث خطأ في حذف التعليق", "error");
    }
}

// ==================== إعداد أحداث الصفحة ====================
function setupPageEvents() {
    // عند تحميل الصفحة، التحقق من وجود story في URL
    const urlParams = new URLSearchParams(window.location.search);
    const storyIdFromUrl = urlParams.get('story');
    if (storyIdFromUrl) {
        // تأخير لضمان تحميل كل شيء
        setTimeout(() => {
            safeShowStoryDetail(storyIdFromUrl);
        }, 500);
    }
    
    // زر العودة في المتصفح
    window.addEventListener('popstate', function(event) {
        const urlParams = new URLSearchParams(window.location.search);
        const storyId = urlParams.get('story');
        
        if (!storyId) {
            // إذا لم يكن هناك story في URL، أظهر الرئيسية
            backToHome();
        } else {
            // إذا كان هناك story، حمله
            setTimeout(() => {
                safeShowStoryDetail(storyId);
            }, 100);
        }
    });
    
    // عند إعادة تحميل الصفحة
    window.addEventListener('beforeunload', function() {
        // تنظيف أي متغيرات مؤقتة إذا لزم الأمر
    });
}

// ==================== وظائف المساعدة ====================

// إعداد مستمعي الأحداث
function setupEventListeners() {
    // أزرار المصادقة
    document.getElementById('login-btn')?.addEventListener('click', () => showModal('loginModal'));
    document.getElementById('register-btn')?.addEventListener('click', () => showModal('registerModal'));
    document.getElementById('logout-btn')?.addEventListener('click', logoutUser);
    document.getElementById('add-story-btn')?.addEventListener('click', openAddStoryModal);
    document.getElementById('start-writing')?.addEventListener('click', () => {
        if (currentUser) {
            openAddStoryModal();
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
    
    // تبديل الوضع الداكن/الفاتح
    setupThemeToggle();
    
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
        
        // إذا كانت نافذة إضافة قصة، قم بإزالتها من DOM
        if (modalId === 'addStoryModal') {
            setTimeout(() => {
                if (modal.parentNode) {
                    modal.parentNode.removeChild(modal);
                }
            }, 300);
        }
    }
}

// عرض حالة المستخدم
function showUserView(email) {
    document.getElementById('guest-view').style.display = 'none';
    document.getElementById('user-view').style.display = 'flex';
    const userEmailElement = document.getElementById('user-email');
    if (userEmailElement) userEmailElement.textContent = email;
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
            showToast("❌ هذا البريد الإلكتروني مستخدم بالفعل", "error");
            break;
        case 'auth/invalid-email':
            showToast("❌ بريد إلكتروني غير صحيح", "error");
            break;
        case 'auth/weak-password':
            showToast("❌ كلمة المرور ضعيفة جداً", "error");
            break;
        case 'auth/user-not-found':
            showToast("❌ لا يوجد حساب بهذا البريد", "error");
            break;
        case 'auth/wrong-password':
            showToast("❌ كلمة المرور غير صحيحة", "error");
            break;
        default:
            showToast("❌ حدث خطأ: " + error.message, "error");
    }
}

// وظائف مساعدة
function updateCurrentYear() {
    const yearElement = document.getElementById('current-year');
    if (yearElement) {
        yearElement.textContent = new Date().getFullYear();
    }
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
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showLoading(show) {
    // يمكنك إضافة spinner إذا أردت
    if (show) {
        console.log("⏳ جاري المعالجة...");
    }
}

function clearForm(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        const inputs = modal.querySelectorAll('input, textarea');
        inputs.forEach(input => {
            input.value = '';
        });
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
window.openAddStoryModal = openAddStoryModal;
window.publishNewStory = publishNewStory;
window.safeShowStoryDetail = safeShowStoryDetail;
window.backToHome = backToHome;
window.editStoryPrompt = editStoryPrompt;
window.deleteStoryPrompt = deleteStoryPrompt;
window.deleteCommentSafe = deleteCommentSafe;