# Permission requests for historical data

Drafts for Diego to send. Nobody has been contacted yet. Do not ingest RSSSF data until a written answer is stored in this folder (`docs/spike/replies/`). The Kaggle dataset is exempt: it is under the PDDL, so the provenance question is not blocking.

What we need in every request: written permission to store the match results and champion lists in our public repository (`data/`), to show derived statistics in a free, non-commercial web app, with attribution, and the exact credit line they want.

## 1. RSSSF (Rec.Sport.Soccer Statistics Foundation)

Where: the contact details are on rsssf.org (site contact page). Mention the Argentina pages by name.

> Subject: Permission request to reuse Argentine league results with attribution
>
> Hello,
>
> I am the author of Rincón del Hincha, a free web app for Argentine football fans that rebuilds each fan's club history (titles lived, record against every rival) from the date they started following their club. The idea comes from Juan Farre.
>
> Your Argentina pages (for example "Final Tables Argentina since 1891" and the per-season league pages) are the most complete source I found for results before 2018. Each page says it can be copied with acknowledgement, and also carries "All rights reserved", so I would like to ask before using anything.
>
> Could you confirm in writing that I may:
>
> 1. Store the match results and final tables of the Argentine first division in the public repository of the project, with a per-record source field.
> 2. Show statistics derived from them in a free, non-commercial web app.
> 3. Credit RSSSF and the page authors as you prefer (please tell me the exact credit line).
>
> The app has no ads and no betting content. I am happy to link back to every page used, and to remove any content on request.
>
> Thank you very much,
> Diego Estela Lopez

## 2. Author of the Kaggle dataset "Liga Argentina 1931 - 2023"

Where: the dataset page on Kaggle (discussion tab or the author's profile). Dataset: `ivanramosctes/liga-argentina-1931-2023`.

Update (2026-10-16): the dataset page shows the license: ODC Public Domain Dedication and Licence (PDDL). The license question is answered, so the message is now a single question about provenance. Sending it is recommended but not blocking.

> Subject: Where does the data of "Liga Argentina 1931 - 2023" come from?
>
> Hello,
>
> I am building Rincón del Hincha, a free app for Argentine football fans, and your dataset (public domain dedication) covers exactly the historical period I need. Before I use it, could you tell me where the data comes from (original source or collection method)? I would like to credit the original authors correctly and to check the results against that source.
>
> Thank you very much,
> Diego Estela Lopez

## Spanish version (same content)

Si preferís escribirles en español, decime y las traduzco con el mismo contenido.

## When an answer arrives

1. Save it (text or screenshot) in `docs/spike/replies/`.
2. Tell me which sources are approved and the credit line required. The rule "no ingestion before a written answer" applies to RSSSF only. For Kaggle (PDDL) a reply only affects the credit line and the provenance notes, not whether the data can be used.
3. For RSSSF, I update ADR 0003, add the adapter and the attribution to `/acerca`, and extend the coverage table.
