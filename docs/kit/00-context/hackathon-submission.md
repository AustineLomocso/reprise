# Hackathon Requirements

Event: IBM Bob 2.0 Hackathon on lablab.ai, online, 48-hour build, 25–27 September 2026. Source: https://lablab.ai/ai-hackathons/ibm-bob-2-hackathon (checked 25 Sep 2026). A cached copy of the page said challenge details and tracks were "coming soon"; confirm tracks and rules on the live page (gate G-13).

## Judging criteria (from the team sheet "Hackathon Details")

| Criterion | Definition | How Reprise answers it |
| --- | --- | --- |
| Application of Technology | How complete and well thought-out the project is, with a clear application of IBM Bob 2.0 | Bob Shell `bob run` powers intake, dedupe confirmation, repro-test writing, root-cause briefs, and fix proposals, each with scoped tool groups and cost caps. Bob IDE is used to build the product, driven by this kit. |
| Presentation | Clarity and effectiveness of the presentation | One demo repo, four seeded issues, one fix, one caught regression, one dashboard. Script in `07-submission/video-script.md`. |
| Business Value | Impact and practical value; how effectively it addresses a high-priority issue | Non-reproducible bugs (~17% of reports) plus the full manual fix-and-prove loop. Dashboard reports time-to-verdict and Bobcoins per issue. |
| Originality | Uniqueness of the solution and the approach in applying Bob | Acts before a developer opens the ticket, and refuses to call anything fixed without statistical and regression evidence. |

## Submission fields (from the team sheet)

| Group | Field | Where the content comes from |
| --- | --- | --- |
| Basic information | Project title | `07-submission/submission-content.md` |
| | Short description | same |
| | Long description | same |
| | Technology and category tags | same |
| Cover and presentation | Cover image | `07-submission/cover-image-brief.md` |
| | Video presentation | `07-submission/video-script.md` |
| | Slide presentation | `07-submission/slides-outline.md` |
| App hosting and code | Demo application platform | GitHub (Actions and Pages) — confirm the field accepts this (gate G-13) |
| | Application URL | The GitHub Pages dashboard URL of `reprise-demo-shop` |
