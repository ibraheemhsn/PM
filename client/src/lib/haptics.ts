/** ردود فعل لمسية (Haptics) — المكافئ الويب لمكتبة react-native-haptic-feedback.
 *
 *  بدل رجّة واحدة طويلة مزعجة (Vibration.vibrate الخام)، نوفّر أنماطاً قصيرة
 *  مدروسة لكل نوع حدث. المدة القصوى (نمط الخطأ) ~130ms — لا رنين هاتف.
 *
 *  يعتمد Vibration API (أندرويد/كروم). iOS/Safari لا يدعمه — تُتجاهَل النداءات
 *  بأمان بلا خطأ. يمكن للمستخدم إيقاف الكل بضبط localStorage['pm-haptics']='off'. */

const supported = typeof navigator !== 'undefined' && 'vibrate' in navigator

function buzz(pattern: number | number[]) {
  if (!supported) return
  if (localStorage.getItem('pm-haptics') === 'off') return
  try {
    navigator.vibrate(pattern)
  } catch {
    // بعض المتصفحات تمنعه خارج تفاعل المستخدم — نتجاهل بصمت
  }
}

export const haptics = {
  /** نقرة اختيار خفيفة جداً — تغيير تبويب/خيار */
  selection: () => buzz(4),
  /** تأثير خفيف — إرسال نموذج، حفظ ناجح */
  light: () => buzz(8),
  /** تأثير متوسط — إجراء ملموس، بلوغ عتبة السحب */
  medium: () => buzz(16),
  /** نجاح — نبضتان قصيرتان (إنجاز مهمة) */
  success: () => buzz([12, 30, 14]),
  /** تحذير — إجراء حساس (حذف/أرشفة) */
  warning: () => buzz([14, 40, 24]),
  /** خطأ — نمط متقطع مميز (فشل حفظ، إدخال خاطئ) */
  error: () => buzz([22, 45, 22, 45, 22]),
}
