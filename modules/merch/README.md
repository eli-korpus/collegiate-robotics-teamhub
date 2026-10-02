# Merch & Orders

**Purpose:** collect team merch orders.

- Managers start an **order drive** with items, prices (text) and sizes. Everyone orders in a few taps.
- **Sizes come from the profile.** If the program has a shirt-size profile field, it's pre-selected; if someone hasn't
  filled it in, the order form asks once and saves it to their profile (single source of truth).
- Members see only their own order; managers see all orders, a “what to order” tally per item and size, paid/delivered
  checkboxes and a CSV.
- **Payments happen outside TeamHub** (stated in the UI). Members can't mark themselves paid, and can't change orders
  after the drive closes: both enforced in the database.
- New Season deletes orders older than one year (export first).

**Not for:** collecting sizes for other reasons (People > Request info), payments.

**Permissions:** order (everyone), manage drives and see all orders (Captains, Mentors), mark paid (Mentors).
