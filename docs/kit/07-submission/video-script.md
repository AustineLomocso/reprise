# Video Script

Target length: 3:00. Adjust to the limit recorded in gate G-13. Record the live run; keep the phase 8 backup recording ready to splice in.

| Time | Screen | Voice-over |
| --- | --- | --- |
| 0:00–0:15 | A GitHub issue list with vague bug titles | "Some bug reports can't be reproduced by the developer who picks them up, and you only find out after hours of trying. Reprise does that work before anyone opens the ticket, and keeps going until the fix is proven." |
| 0:15–0:35 | Seed script creates the three stage-1 issues; Actions tab shows three runs | "Here are three real-looking reports. A maintainer opts them in, and Reprise starts on each one in GitHub Actions, using IBM Bob." |
| 0:35–1:05 | BULK verdict comment: strip of 20 failures, likely cause, first bad commit | "Bulk discount: Bob wrote a test that fails for exactly the reported reason, Reprise ran it 20 times, 20 failures. Bob found the cause, and bisect found the commit that introduced it." |
| 1:05–1:25 | RACE verdict with <k>/20 and interval | "The overselling bug only happens sometimes. Instead of 'works for me', Reprise measured it: <k> of 20 runs, with a confidence interval." |
| 1:25–1:40 | VAGUE verdict with one question; DUP created, duplicate verdict | "The vague report gets one precise question. And this report says the same thing as the first in completely different words, so it's marked as a duplicate, with the reason." |
| 1:40–2:10 | `/reprise fix` on BULK, draft PR, verification comment, green status | "Now the fix. One comment and Bob proposes a fix. Reprise tests it, opens a pull request, and verifies it: the reproduction test passes, and the whole suite is compared against main. Nothing else broke." |
| 2:10–2:35 | Human bad-fix PR, red status, table naming the 9-unit test | "Here's a fix a person might write: change the threshold to 9. The reproduction test passes, but Reprise catches that nine mugs now get a discount. Regression detected." |
| 2:35–2:50 | Dashboard overview and RACE detail with before and after strips | "Everything lands on a public dashboard: before, <k> of 20 failed; after the fix, <n> clean runs, enough to rule the bug out at 95% confidence." |
| 2:50–3:00 | Title card with URL | "Reprise: from filed to fixed, with proof. Built on IBM Bob 2.0, running free on GitHub." |
