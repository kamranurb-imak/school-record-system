import { requireProfile } from '@/lib/auth'
import { CommentCodeManager } from './comment-code-manager'

export default async function CommentCodesPage() {
  const { supabase, profile } = await requireProfile(['admin'])

  const { data: codes } = await supabase
    .from('comment_codes')
    .select('*')
    .eq('school_id', profile.school_id)
    .order('sort_order')

  return <CommentCodeManager codes={(codes as any[]) ?? []} schoolId={profile.school_id} />
}
