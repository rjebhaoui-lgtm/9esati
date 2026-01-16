// script.js - الإصدار الكامل مع جميع الميزات الجديدة
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

// نظام الوضع الداكن/الفاتح
let currentTheme = localStorage.getItem('theme') || 'light';

// نظام الأجزاء المتعددة
let currentStoryParts = [];
let currentPartIndex = 0;

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
});

// ==================== نظام الوضع الداكن/الفاتح ====================

// تطبيق الوضع
function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
    updateThemeButton(theme);
}

// تحديث زر التبديل
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

// تبديل الوضع
function toggleTheme() {
    currentTheme = currentTheme === 'light' ? 'dark' : 'light';
    applyTheme(currentTheme);
}

// إعداد حدث الزر
function setupThemeToggle() {
    const themeBtn = document.getElementById('theme-toggle-btn');
    if (themeBtn) {
        themeBtn.addEventListener('click', toggleTheme);
    }
}

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
                        '<button onclick="showAddStoryModal()" class="btn-primary">اكتب أول قصة</button>' : 
                        '<button onclick="showModal(\'registerModal\')" class="btn-primary">سجل واكتب قصة</button>'
                    }
                </div>
            `;
        } else {
            let storiesHTML = '';
            
            querySnapshot.forEach((doc) => {
                const story = doc.data();
                const storyId = doc.id;
                
                // التحقق إذا كانت القصة متعددة الأجزاء
                const isMultiPart = story.isMultiPart || false;
                const totalParts = story.totalParts || 1;
                const currentPart = story.currentPart || 1;
                
                storiesHTML += `
                    <div class="story-card" onclick="showStoryDetail('${storyId}')" style="cursor: pointer;">
                        <div class="story-card-header">
                            <div>
                                <h3 class="story-title">${escapeHtml(story.title) || 'بدون عنوان'}</h3>
                                ${isMultiPart ? 
                                    `<span class="multi-part-badge">
                                        <i class="fas fa-layer-group"></i>
                                        ${currentPart}/${totalParts} جزء
                                    </span>` : 
                                    ''
                                }
                            </div>
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

// إضافة قصة جديدة (نظام الأجزاء المتعددة)
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
    
    const isMultiPart = confirm("📚 هل هذه القصة متعددة الأجزاء؟\n\nنعم: للقصص الطويلة ذات الأجزاء\nلا: لقصة واحدة كاملة");
    
    let content = "";
    let parts = 1;
    
    if (isMultiPart) {
        const partsInput = prompt("📖 كم جزء تريد إضافته الآن؟ (يمكنك إضافة الباقي لاحقاً)", "1");
        parts = parseInt(partsInput) || 1;
        
        if (parts > 1) {
            // إضافة أجزاء متعددة
            for (let i = 1; i <= parts; i++) {
                const partContent = prompt(`📝 الجزء ${i} من ${parts}:\n(اكتب بالدارجة المغربية)`);
                if (partContent && partContent.trim()) {
                    content += `\n[الجزء ${i}]\n${partContent.trim()}\n`;
                }
            }
        } else {
            // جزء واحد فقط
            const partContent = prompt("📝 محتوى القصة (اكتب بالدارجة المغربية):");
            content = partContent ? `[الجزء 1]\n${partContent.trim()}` : "";
        }
    } else {
        // قصة واحدة كاملة
        content = prompt("📝 محتوى القصة (اكتب بالدارجة المغربية):");
    }
    
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
            comments: 0,
            isMultiPart: isMultiPart,
            totalParts: parts,
            currentPart: 1
        });
        
        showMessage(`✅ تم نشر ${isMultiPart && parts > 1 ? 'الجزء الأول من ' : ''}قصتك بنجاح!`, "success");
        loadStories();
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
        currentStoryParts = [];
        currentPartIndex = 0;
        
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
        
        // معالجة الأجزاء المتعددة
        if (story.isMultiPart) {
            currentStoryParts = extractStoryParts(story.content);
            setupPartsNavigation(story.totalParts || 1);
        } else {
            document.getElementById('parts-navigation').style.display = 'none';
        }
        
        // عرض بيانات القصة
        document.getElementById('story-detail-title').textContent = story.title;
        document.getElementById('author-name').textContent = story.author;
        document.getElementById('story-date').textContent = formatDate(story.createdAt);
        document.getElementById('story-category').textContent = story.category;
        document.getElementById('story-views').textContent = (story.views || 0) + 1;
        document.getElementById('likes-count').textContent = story.likes || 0;
        
        currentStoryLikes = story.likes || 0;
        
        // عرض المحتوى
        displayCurrentPart();
        
        // تحميل التعليقات
        loadComments(storyId);
        
        // تفعيل زر الإعجاب
        setupLikeButton(storyId, story.likes || 0);
        
        // إعداد حماية النسخ
        setupCopyProtection();
        
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
    
    // إذا لم توجد أجزاء محددة، تعامل مع المحتوى كجزء واحد
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
    const indicator = document.getElementById('parts-indicator');
    
    if (currentStoryParts.length <= 1) {
        partsNav.style.display = 'none';
        return;
    }
    
    partsNav.style.display = 'flex';
    updatePartsIndicator();
    
    // أحداث الأزرار
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

// تحديث تنقل الأجزاء
function updatePartsNavigation() {
    const prevBtn = document.getElementById('prev-part-btn');
    const nextBtn = document.getElementById('next-part-btn');
    
    prevBtn.disabled = currentPartIndex === 0;
    nextBtn.disabled = currentPartIndex === currentStoryParts.length - 1;
    
    updatePartsIndicator();
}

// تحديث مؤشر الأجزاء
function updatePartsIndicator() {
    const currentPartSpan = document.getElementById('current-part');
    const totalPartsSpan = document.getElementById('total-parts');
    
    currentPartSpan.textContent = currentStoryParts[currentPartIndex]?.number || 1;
    totalPartsSpan.textContent = currentStoryParts.length;
}

// عرض الجزء الحالي
function displayCurrentPart() {
    const storyContent = document.getElementById('story-detail-content');
    
    if (currentStoryParts.length > 0) {
        const currentPart = currentStoryParts[currentPartIndex];
        storyContent.textContent = currentPart.content;
    }
    
    updatePartsNavigation();
}

// العودة للصفحة الرئيسية
function backToHome() {
    document.querySelector('main').style.display = 'block';
    document.getElementById('story-detail-page').style.display = 'none';
    
    // إعادة تعيين المتغيرات
    currentStoryId = null;
    currentStoryLikes = 0;
    hasLiked = false;
    currentStoryParts = [];
    currentPartIndex = 0;
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

// ==================== حماية منع النسخ ====================

// إعداد حماية النسخ
function setupCopyProtection() {
    const storyContent = document.getElementById('story-detail-content');
    const protectionMessage = document.getElementById('copy-protection-message');
    
    if (!storyContent) return;
    
    // منع اختصار Ctrl+C, Ctrl+X, Ctrl+V
    document.addEventListener('keydown', function(e) {
        if (storyContent.contains(document.activeElement)) {
            // Ctrl+C أو Ctrl+X
            if ((e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'x')) {
                e.preventDefault();
                showProtectionAlert();
                return false;
            }
        }
    });
    
    // عند محاولة النسخ
    document.addEventListener('copy', function(e) {
        if (storyContent.contains(e.target)) {
            e.preventDefault();
            showProtectionAlert();
            return false;
        }
    });
    
    // إظهار/إخفاء رسالة الحماية
    if (protectionMessage) {
        storyContent.addEventListener('mouseenter', () => {
            protectionMessage.style.opacity = '1';
        });
        
        storyContent.addEventListener('mouseleave', () => {
            protectionMessage.style.opacity = '0.7';
        });
    }
}

// عرض تحذير الحماية
function showProtectionAlert() {
    showMessage("🔒 هذه القصة محمية بحقوق النشر. لا يسمح بنسخها دون إذن الكاتب.", "warning");
    
    // تأثير اهتزاز
    const storyContent = document.getElementById('story-detail-content');
    if (storyContent) {
        storyContent.classList.add('shake');
        setTimeout(() => {
            storyContent.classList.remove('shake');
        }, 500);
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

function showMessage(message, type = 'info') {
    alert(message);
}

function showLoading(show) {
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
window.showStoryDetail = showStoryDetail;
window.backToHome = backToHome;