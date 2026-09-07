# ADR-008: Balance sheet equity is a computed plug; cash flow has no investing/financing sections

**Context:** Slice 4's balance sheet needs Assets = Liabilities + Equity
to hold. This system has no owner's-capital, drawings, or share-capital
transactions modeled -- nothing posts to an equity account. Likewise, a
full indirect-method cash flow statement has three sections (operating,
investing, financing); this system has no fixed-asset purchase, loan, or
share-capital transactions either, so two of the three sections would
always be empty by construction, not because nothing happened in them.

**Options:**
- Model a real Capital/Equity account and post opening-balance entries
  and retained-earnings closing entries to it every period (real
  double-entry equity, the "correct" long-term answer).
- Compute equity as a plug (`Assets - Liabilities`) on every balance
  sheet request, and label it as computed; compute cash flow as a flat
  direct-method list of cash movement by document type, with no
  operating/investing/financing labels at all.

**Choice:** The second option for now. Building real equity postings
without any of the transactions that would actually populate them
(capital introduced, drawings taken, year-end closing entries) means
building ceremony with nothing behind it. A labelled "Retained Earnings
(computed)" line is honest about being a balancing figure, not a posted
account balance. Similarly, calling the cash flow statement's single
section "Cash movement by document type" rather than "Operating
Activities" avoids implying investing/financing sections were checked
and found empty.

**Consequence:** The balance sheet always balances by construction
(equity is defined as the plug), which is not the same guarantee as a
real chart of accounts where equity could be wrong and reveal a bug.
Once Purchase of fixed assets, loans, or owner's capital transactions
exist as real documents, this ADR should be revisited and the plug
replaced with real postings.

**Reversibility:** Reversible. Introducing a real equity account and
retiring the plug is additive -- existing asset/liability accounts and
their historical journal lines are unaffected.
