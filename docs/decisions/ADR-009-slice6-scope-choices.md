# ADR-009: Slice 6 scope choices -- notification targeting, payments, approvals

**Context:** Slice 6 bundles three fairly different features (customer
portal, notification centre, approval workflows) and dev.md's spec for
each assumes infrastructure or data this system doesn't have yet.

**Notification targeting.** dev.md §62 implies per-user targeted
notifications (assigned salesperson, etc.), but nothing in this system
assigns a salesperson to a customer or order yet. Notifications here are
tenant-wide (visible to any authenticated staff user, gated by RLS like
everything else, not by a per-resource permission check), not per-user.
Revisit once an assignment model exists.

**Customer portal payments.** dev.md §58 says a customer can "make a
payment." No payment gateway credentials exist here (same reasoning as
ADR-007's GSP/NIC gap) -- a customer submits a payment *intimation*
(amount, mode, reference/UTR), which creates a real `Receipt` the same
way staff-recorded payments do. It is not itself a payment capture; a
real gateway integration is real future work, not something to fake
with a checkout-shaped UI that doesn't move money.

**Approval workflows.** dev.md §63's examples (discount >10%, margin
<5%, purchase >₹5L) assume manual discount entry and margin-threshold
UI that don't exist in this system's price engine (Slice 1 prices from
rate contracts/customer prices/standard price, not a discount field).
The one trigger that already exists end-to-end is B25's credit-limit
check. `ApprovalRule`/`ApprovalRequest` are built generically (any
`trigger_type` can be added later), but only `credit_limit_exceeded` is
wired to a real call site now: a blocked sales order creates a pending
approval request instead of only raising an error, and an approved
request lets the same order creation succeed on retry.

**Reversibility:** All reversible. Per-user notification targeting is
additive once an assignment model exists; a real payment gateway
replaces the intimation flow without changing the Receipt shape it
already produces; new approval trigger types are additive rows plus one
new call site each.

**Implementation note added after the fact:** `request_approval` writes
the pending `ApprovalRequest` (and its notification) through its own
committed session rather than the failing request's session. The
request that trips the credit-limit check gets rolled back by
`deps.get_db_tenant` like any other failed request (B6) -- if the
approval row were written through that same session it would vanish
along with everything else, defeating the whole feature.
