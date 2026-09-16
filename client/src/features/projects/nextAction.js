// What the client should do next, in priority order: decide on something
// waiting, read what changed, or check the milestone in flight.
export function nextAction({ pendingApprovals = [], milestones = [], lastMessageAt, userRole }) {
  if (userRole !== 'admin' && pendingApprovals.length) {
    const first = pendingApprovals[0]
    return { kind: 'approval', title: `Review ${first.deliverableTitle} · v${first.versionNumber}`, text: first.message || 'A design is waiting for your decision.', to: 'approvals', label: pendingApprovals.length > 1 ? `Review ${pendingApprovals.length} decisions` : 'Review and decide' }
  }
  const active = milestones.find((m) => m.state === 'active')
  if (active) return { kind: 'milestone', title: active.title, text: active.note || 'This is the stage in progress right now.', to: 'milestones', label: 'See the route ahead' }
  if (lastMessageAt) return { kind: 'message', title: 'Catch up on the channel', text: 'There are updates in the project channel.', to: 'messages', label: 'Read updates' }
  return { kind: 'quiet', title: 'Nothing waiting on you', text: 'You will see it here first when something needs a decision.', to: 'messages', label: 'Leave a note' }
}
