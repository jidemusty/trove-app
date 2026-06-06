import { CategoryView } from '#/components/categories/CategoryView.tsx'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/app/')({
  component: AppHome,
})

function AppHome() {
  const { user } = Route.useRouteContext()

  return (
    <main className="page-wrap px-4 pb-16 pt-10">
      <header className="mb-8">
        <p className="island-kicker mb-1">Your Trove</p>
        <h1 className="text-3xl font-bold tracking-tight text-[var(--sea-ink)]">
          Hi, {user.name || user.email}
        </h1>
      </header>
      <CategoryView parentId={null} />
    </main>
  )
}
