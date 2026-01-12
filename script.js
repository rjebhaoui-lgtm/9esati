console.log("موقع 9esati يعمل!");

// تحديث السنة في الفوتر
document.addEventListener('DOMContentLoaded', function() {
    console.log("الصفحة محملة بنجاح");
    
    // تحديث السنة
    const yearElement = document.querySelector('footer p');
    if (yearElement) {
        yearElement.innerHTML = `© ${new Date().getFullYear()} 9esati - صنع في المغرب`;
    }
    
    // تفعيل زر ابدأ القراءة
    const startButton = document.querySelector('.btn');
    if (startButton) {
        startButton.addEventListener('click', function() {
            alert("مرحباً! سنبدأ قريباً بإضافة القصص الحقيقية.");
        });
    }
});