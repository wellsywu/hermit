import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Shield, Trash2, Database, UserPlus } from 'lucide-react'
import { api } from '#/api'
import type { APIError, RepoMember } from '#/api'
import { useFlash } from '#/components/ui/Toast'
import { msg, useT } from '#/i18n'

const ROLE_OPTIONS = [
  { value: 'admin', label: msg('Admin'), color: 'badge-error' },
  { value: 'developer', label: msg('Developer'), color: 'badge-warning' },
  { value: 'viewer', label: msg('Viewer'), color: 'badge-info' },
] as const

function roleBadgeColor(role: string) {
  return ROLE_OPTIONS.find((r) => r.value === role)?.color ?? 'badge-ghost'
}

export function RBACSection() {
  const t = useT()
  const queryClient = useQueryClient()
  const { setError, setSuccess } = useFlash()
  const [showAssignForm, setShowAssignForm] = useState(false)
  const [assignRepoId, setAssignRepoId] = useState('')
  const [assignSubject, setAssignSubject] = useState('')
  const [assignRole, setAssignRole] = useState('viewer')

  const { data: membersData, isLoading } = useQuery({
    queryKey: ['rbac-members'],
    queryFn: () => api.listAllMembers(),
  })

  const { data: stats } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: () => api.getDashboardStats(),
  })

  const assignMutation = useMutation({
    mutationFn: ({
      repoId,
      subject,
      role,
    }: {
      repoId: string
      subject: string
      role: string
    }) => api.assignMember(repoId, subject, role),
    onSuccess: () => {
      setSuccess(t('Member assigned'))
      setError(null)
      setShowAssignForm(false)
      setAssignSubject('')
      setAssignRole('viewer')
      queryClient.invalidateQueries({ queryKey: ['rbac-members'] })
    },
    onError: (err: APIError) => {
      setError(err.message)
      setSuccess(null)
    },
  })

  const removeMutation = useMutation({
    mutationFn: ({ repoId, subject }: { repoId: string; subject: string }) =>
      api.removeMember(repoId, subject),
    onSuccess: () => {
      setSuccess(t('Member removed'))
      setError(null)
      queryClient.invalidateQueries({ queryKey: ['rbac-members'] })
    },
    onError: (err: APIError) => {
      setError(err.message)
      setSuccess(null)
    },
  })

  const members = membersData?.members ?? []
  const repos = stats?.repositories ?? []

  const membersByRepo = new Map<string, RepoMember[]>()
  for (const m of members) {
    const list = membersByRepo.get(m.repoName) ?? []
    list.push(m)
    membersByRepo.set(m.repoName, list)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">
          {t('Access control')}
        </h1>
        <button
          className="btn btn-sm btn-outline"
          onClick={() => setShowAssignForm(!showAssignForm)}
        >
          <UserPlus className="h-4 w-4" />
          {t('Assign Member')}
        </button>
      </div>

      <div className="card bg-base-100 border">
        <div className="card-body py-3">
          <div className="flex flex-wrap gap-6 text-sm">
            <div>
              <span className="text-base-content/60">{t('Roles:')} </span>
              {ROLE_OPTIONS.map((r) => (
                <span
                  key={r.value}
                  className={`badge ${r.color} badge-sm mx-1`}
                >
                  {t(r.label)}
                </span>
              ))}
            </div>
            <div className="text-base-content/60">
              <strong>{t('Admin')}</strong>{' '}
              {t('= read + publish + delete any skill ·')}{' '}
              <strong>{t('Developer')}</strong>{' '}
              {t('= read + publish + delete own skills ·')}{' '}
              <strong>{t('Viewer')}</strong> {t('= read only')}
            </div>
          </div>
        </div>
      </div>

      {showAssignForm && (
        <div className="card bg-base-100 border">
          <div className="card-body">
            <h3 className="font-semibold">
              {t('Assign Member to Repository')}
            </h3>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                assignMutation.mutate({
                  repoId: assignRepoId,
                  subject: assignSubject.trim(),
                  role: assignRole,
                })
              }}
              className="space-y-3"
            >
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <fieldset className="fieldset">
                  <legend className="fieldset-legend text-xs">
                    {t('Repository')}
                  </legend>
                  <select
                    className="select select-bordered select-sm w-full"
                    value={assignRepoId}
                    onChange={(e) => setAssignRepoId(e.target.value)}
                    required
                  >
                    <option value="">{t('Select repository...')}</option>
                    {repos
                      .filter((r) => r.type !== 'group')
                      .map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name} ({r.type})
                        </option>
                      ))}
                  </select>
                </fieldset>
                <fieldset className="fieldset">
                  <legend className="fieldset-legend text-xs">
                    {t('Subject (username, ldap:name or *)')}
                  </legend>
                  <input
                    type="text"
                    placeholder={t('e.g. alice, ldap:bob, *')}
                    value={assignSubject}
                    onChange={(e) => setAssignSubject(e.target.value)}
                    className="input input-bordered input-sm w-full"
                    required
                  />
                </fieldset>
                <fieldset className="fieldset">
                  <legend className="fieldset-legend text-xs">
                    {t('Role')}
                  </legend>
                  <select
                    className="select select-bordered select-sm w-full"
                    value={assignRole}
                    onChange={(e) => setAssignRole(e.target.value)}
                  >
                    {ROLE_OPTIONS.map((r) => (
                      <option key={r.value} value={r.value}>
                        {t(r.label)}
                      </option>
                    ))}
                  </select>
                </fieldset>
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="btn btn-primary btn-sm"
                  disabled={assignMutation.isPending}
                >
                  {assignMutation.isPending ? t('Assigning…') : t('Assign')}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setShowAssignForm(false)}
                >
                  {t('Cancel')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="card bg-base-100 border">
        <div className="card-body">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <span className="loading loading-dots loading-md" />
            </div>
          ) : members.length === 0 ? (
            <div className="text-center py-8 text-base-content/60">
              <Shield className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <p>{t('No members assigned')}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {Array.from(membersByRepo.entries()).map(
                ([repoName, repoMembers]) => (
                  <div key={repoName}>
                    <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                      <Database className="h-3.5 w-3.5" />
                      {repoName}
                    </h4>
                    <div className="overflow-x-auto">
                      <table className="table table-sm">
                        <thead>
                          <tr>
                            <th>{t('Subject')}</th>
                            <th>{t('Role')}</th>
                            <th>{t('Granted by')}</th>
                            <th>{t('Actions')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {repoMembers.map((m) => (
                            <MemberRow
                              key={`${m.repoId}-${m.subject}`}
                              member={m}
                              onRemove={() =>
                                removeMutation.mutate({
                                  repoId: m.repoId,
                                  subject: m.subject,
                                })
                              }
                              isRemoving={removeMutation.isPending}
                            />
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ),
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function MemberRow({
  member,
  onRemove,
  isRemoving,
}: {
  member: RepoMember
  onRemove: () => void
  isRemoving: boolean
}) {
  const t = useT()
  const [confirm, setConfirm] = useState(false)

  return (
    <tr>
      <td>
        <code className="text-sm bg-base-300 px-2 py-0.5 rounded">
          {member.subject}
        </code>
      </td>
      <td>
        <span className={`badge badge-sm ${roleBadgeColor(member.role)}`}>
          {member.role}
        </span>
      </td>
      <td className="text-xs text-base-content/60">
        {member.grantedBy || '—'}
        {member.updatedAt && (
          <span className="ml-1 opacity-70">
            {new Date(member.updatedAt).toLocaleDateString()}
          </span>
        )}
      </td>
      <td>
        {confirm ? (
          <div className="flex gap-1 items-center">
            <span className="text-xs">{t('Remove?')}</span>
            <button
              onClick={() => {
                onRemove()
                setConfirm(false)
              }}
              className="btn btn-error btn-xs"
              disabled={isRemoving}
            >
              {t('Yes')}
            </button>
            <button
              onClick={() => setConfirm(false)}
              className="btn btn-ghost btn-xs"
            >
              {t('No')}
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirm(true)}
            className="btn btn-ghost btn-xs text-error"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </td>
    </tr>
  )
}
