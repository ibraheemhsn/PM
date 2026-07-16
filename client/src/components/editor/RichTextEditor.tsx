import Image from '@tiptap/extension-image'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import {
  Bold, Heading2, Heading3, ImagePlus, Italic, Link2, List, ListOrdered,
  Quote, Redo2, Strikethrough, Undo2, Unlink,
} from 'lucide-react'
import { useRef, useState, type ChangeEvent, type ReactNode } from 'react'
import { api } from '../../lib/api'
import { cn } from '../../lib/utils'

interface RichTextEditorProps {
  /** المحتوى الابتدائي (HTML) — المكوّن غير متحكَّم به بعد التهيئة،
   *  لذا مرِّر key={projectId} من الأب لإعادة التهيئة عند تبديل المشروع. */
  initialContent: string
  onChange: (html: string) => void
}

export function RichTextEditor({ initialContent, onChange }: RichTextEditorProps) {
  const imageInputRef = useRef<HTMLInputElement>(null)
  const [uploadingImage, setUploadingImage] = useState(false)
  // حارس ثابت عبر الإغلاقات (اللصق/الإفلات يلتقطان أول نسخة من الدوال)
  const uploadingRef = useRef(false)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] } }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        HTMLAttributes: { target: '_blank', rel: 'noopener noreferrer' },
      }),
      Image,
      Placeholder.configure({
        placeholder: 'اكتب التفاصيل الفنية والمواصفات هنا… يمكنك إضافة عناوين وقوائم وروابط وصور.',
      }),
    ],
    content: initialContent,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: { class: 'rich-text min-h-[220px] p-4', dir: 'rtl' },
      // لصق صورة من الحافظة أو إفلات ملف صورة داخل المحرر → رفع وإدراج فوري
      handlePaste: (_view, event) => {
        const files = Array.from(event.clipboardData?.files ?? []).filter((f) =>
          f.type.startsWith('image/'),
        )
        if (files.length === 0) return false
        event.preventDefault()
        void uploadImages(files)
        return true
      },
      handleDrop: (_view, event) => {
        const files = Array.from(event.dataTransfer?.files ?? []).filter((f) =>
          f.type.startsWith('image/'),
        )
        if (files.length === 0) return false
        event.preventDefault()
        void uploadImages(files)
        return true
      },
    },
  })

  /** رفع صور (زر الأدوات أو اللصق أو الإفلات) وإدراجها في موضع المؤشر */
  const uploadImages = async (files: File[]) => {
    if (uploadingRef.current) return
    uploadingRef.current = true
    setUploadingImage(true)
    try {
      for (const file of files) {
        const { url } = await api.uploads.image(file)
        editor?.chain().focus().setImage({ src: url, alt: file.name }).run()
      }
    } catch {
      window.alert('تعذر رفع الصورة — تحقق من الاتصال بالخادم ونوع الملف.')
    } finally {
      uploadingRef.current = false
      setUploadingImage(false)
    }
  }

  if (!editor) return null

  const setLink = () => {
    const previous = editor.getAttributes('link').href as string | undefined
    const url = window.prompt('أدخل الرابط (URL):', previous ?? 'https://')
    if (url === null) return
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
      return
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
  }

  const handleImagePick = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (file) void uploadImages([file])
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center gap-0.5 border-b border-slate-100 px-2 py-1.5">
        <ToolbarButton
          title="عريض"
          active={editor.isActive('bold')}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <Bold size={16} />
        </ToolbarButton>
        <ToolbarButton
          title="مائل"
          active={editor.isActive('italic')}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <Italic size={16} />
        </ToolbarButton>
        <ToolbarButton
          title="يتوسطه خط"
          active={editor.isActive('strike')}
          onClick={() => editor.chain().focus().toggleStrike().run()}
        >
          <Strikethrough size={16} />
        </ToolbarButton>

        <Divider />

        <ToolbarButton
          title="عنوان رئيسي"
          active={editor.isActive('heading', { level: 2 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        >
          <Heading2 size={16} />
        </ToolbarButton>
        <ToolbarButton
          title="عنوان فرعي"
          active={editor.isActive('heading', { level: 3 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        >
          <Heading3 size={16} />
        </ToolbarButton>

        <Divider />

        <ToolbarButton
          title="قائمة نقطية"
          active={editor.isActive('bulletList')}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <List size={16} />
        </ToolbarButton>
        <ToolbarButton
          title="قائمة مرقمة"
          active={editor.isActive('orderedList')}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered size={16} />
        </ToolbarButton>
        <ToolbarButton
          title="اقتباس"
          active={editor.isActive('blockquote')}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
        >
          <Quote size={16} />
        </ToolbarButton>

        <Divider />

        <ToolbarButton title="إدراج رابط تشعبي" active={editor.isActive('link')} onClick={setLink}>
          <Link2 size={16} />
        </ToolbarButton>
        <ToolbarButton
          title="إزالة الرابط"
          onClick={() => editor.chain().focus().unsetLink().run()}
        >
          <Unlink size={16} />
        </ToolbarButton>
        <ToolbarButton
          title={uploadingImage ? 'جارٍ رفع الصورة…' : 'إدراج صورة'}
          onClick={() => imageInputRef.current?.click()}
        >
          <ImagePlus size={16} className={cn(uploadingImage && 'animate-pulse')} />
        </ToolbarButton>
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          onChange={handleImagePick}
          className="hidden"
        />

        <Divider />

        <ToolbarButton title="تراجع" onClick={() => editor.chain().focus().undo().run()}>
          <Undo2 size={16} />
        </ToolbarButton>
        <ToolbarButton title="إعادة" onClick={() => editor.chain().focus().redo().run()}>
          <Redo2 size={16} />
        </ToolbarButton>
      </div>

      <EditorContent editor={editor} />
    </div>
  )
}

function ToolbarButton({ title, active, onClick, children }: {
  title: string
  active?: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={cn(
        'rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700',
        active && 'bg-blue-50 text-blue-600',
      )}
    >
      {children}
    </button>
  )
}

function Divider() {
  return <span className="mx-1 h-5 w-px bg-slate-200" />
}
