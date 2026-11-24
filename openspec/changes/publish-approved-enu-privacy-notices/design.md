# Design: ENU privacy notice publication

## Scope boundary

This change treats the privacy notice as an institutional/legal artifact implemented by the application, not as text that the software project can approve on the institution's behalf.

The first stage therefore records verified technical facts and drafts, while final publication remains blocked on institutional validation.

## Treatment groups evidenced by ENU

| Treatment | Evidence in ENU | Data-subject scope |
| --- | --- | --- |
| Worker master record | `workers` and related worker relations | Workers |
| Account linkage and authorization | `profiles`, roles and Auth linkage | Workers, staff/admin accounts |
| Schedules | teacher and assignment schedules | Workers; academic context |
| Worker document repository | document metadata and private storage | Workers; potentially students/third parties inside uploaded academic records |
| Access-email correction workflow | correction-state records | Workers/accounts |

Academic/tutoring uploads such as attendance lists, evaluation records, final-grade consolidations and tutoring referrals may contain student or third-party personal data. The notice/inventory SHALL NOT assume every such file contains sensitive data, but the institutional review must classify the actual contents and purposes.

## Publication model

After approval:

1. The integral notice is publicly available without authentication at a stable route (proposed: `/privacy`).
2. The simplified notice is presented before direct personal-data collection where the application creates or uploads worker records/documents.
3. Public authentication and recovery surfaces expose a persistent link to the integral notice; any flow that institutionally qualifies as a direct collection point also presents the approved simplified notice.
4. The simplified notice links to the integral notice.
5. Notice content is kept in a single application-owned source so collection surfaces do not drift into divergent legal text.

## Approval gates

Publication is blocked until the institution confirms:

- exact legal denomination of the Responsible;
- address of the Responsible to state in the notice;
- current physical address and official channel of the Transparency Unit for ARCO rights;
- treatment purposes and which, if any, require consent;
- purpose-specific legal bases;
- transfer recipients/purposes and which, if any, require consent;
- whether existing SETAB privacy notices already govern all or part of ENU's treatment and should be linked/adopted instead of duplicated;
- classification of uploaded academic/tutoring documents that may contain third-party or sensitive personal data;
- institutional approval authority and approval record/version date.

## Legal baseline recorded for review

The drafting baseline is the current Ley de Protección de Datos Personales en Posesión de Sujetos Obligados del Estado de Tabasco (published 14 June 2025), especially its requirements for integral/simplified notices and timing of the simplified notice. The current federal general law and the applicable Tabasco archival, labor, education, and SETAB organizational rules must be used to complete purpose-specific legal bases.

The Tabasco official gazette reported on 25 February 2026 that the 2018 personal-data guidelines remain temporarily mandatory until new rules under the current state law are issued. Institutional legal review should therefore check the drafts against those transitional guidelines as well.

## Safety decisions

- No real personal-data values are copied into the repository.
- Cloud providers are not labeled as consent-based "transfers" merely because the system uses hosted infrastructure; their legal role (for example, processor/remission) and contractual basis must be validated institutionally.
- No draft is exposed through the deployed UI until approval placeholders are eliminated.
- The application must not state that ENU is legally compliant merely because a notice is published.
