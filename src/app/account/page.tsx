import { redirect } from 'next/navigation'

// /account itself is no longer a distinct "Overview" page — its content
// (the redundant avatar/name greeting aside) moved into
// /account/courses, which is now the default landing page for the
// dashboard. Kept as a server-side redirect, not deleted, since
// login/register still send users here and Header links here too.
export default function AccountPage() {
  redirect('/account/courses')
}
