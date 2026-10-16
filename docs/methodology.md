# Methodology (draft)

These rules are the source of truth for every statistic in the app. Each rule has its own tests in `tests/unit/domain`.

- **Fan period:** from the start date (inclusive) until today, in the `America/Argentina/Buenos_Aires` time zone.
- **A title counts** if its `consecration_date` falls inside the period.
- **Match result:** the score at the end of regulation plus extra time, if any. A penalty shoot-out **counts as a draw** in P/W/D/L and is recorded separately. In finals and titles, the shoot-out winner wins the final.
- **Balance** = W - L. Draws do not change it.
- **Dominance:** "Dominás" if balance >= +2, "Parejo" if between -1 and +1, "Te domina" if <= -2. Thresholds live in a configurable constant.
- **Suspended matches** do not count. **Administrative results** count with a visible mark.
- **Classics:** defined by the `rivalries` table.
- **Partial coverage:** if the start date is earlier than the club's full coverage, the UI shows a clear notice. Incomplete data is never presented as complete.
- **Disputed titles** (AFA recognition, amateur era, etc.): the criterion and source are shown. By default only officially recognized titles count.
