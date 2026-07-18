import { MutationCache, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { haptics } from './lib/haptics'
import './index.css'

const queryClient = new QueryClient({
  // نقطة مركزية لكل عمليات الحفظ: اهتزاز خفيف عند النجاح (إرسال نموذج/حفظ)
  // ونمط خطأ عند الفشل — يغطي كل النماذج والإجراءات دفعةً واحدة
  mutationCache: new MutationCache({
    onSuccess: () => haptics.light(),
    onError: (error) => {
      haptics.error()
      const message = error instanceof Error ? error.message : String(error)
      if (message.includes('API 403')) {
        window.alert(
          'انتهت صلاحية جلسة الدخول أو رُفض الطلب — أعد تحميل الصفحة وسجّل الدخول من جديد.\n\n' +
          `تفاصيل الخطأ:\n${message}`,
        )
      } else {
        window.alert(`تعذّر حفظ التغييرات:\n${message}`)
      }
    },
  }),
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1 },
  },
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
)
