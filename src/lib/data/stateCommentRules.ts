// How the public comments on a pending case, per state, and whether comments
// still count once the hearing is over. Researched from each commission's own
// pages; "unknown" means we could not confirm it, not that there is no rule.

export type RecordRule = "closes_at_hearing" | "open_until_decision" | "varies" | "unknown";

export interface StateCommentRule {
  commentUrl: string;
  howToComment: string;
  recordRule: RecordRule;
  ruleNote: string;
  sourceUrl: string;
}

export const STATE_COMMENT_RULES: Record<string, StateCommentRule> = {
  AK: {
    "commentUrl": "",
    "howToComment": "Use the submit comment link on the notice page of the Commission website, or email rca.mail@alaska.gov or mail a signed letter with the docket number.",
    "recordRule": "unknown",
    "ruleNote": "The RCA site blocked automated access (403) and this method came only from search result summaries, so the comment deadline rule is unconfirmed.",
    "sourceUrl": ""
  },
  AL: {
    "commentUrl": "https://psc.alabama.gov/",
    "howToComment": "Comments on a docket are filed with the Commission under its Rules of Practice, using the e-filing portal or by mail to the Commission in Montgomery, or call Consumer Services at 1-800-392-8050.",
    "recordRule": "unknown",
    "ruleNote": "Deadlines are set docket by docket (for example initial and reply comment dates) and I found no general rule for public comments.",
    "sourceUrl": "https://psc.alabama.gov/"
  },
  AR: {
    "commentUrl": "https://apsc.arkansas.gov/home/public-comments/",
    "howToComment": "Pick the docket number on the Commission public comment page and submit the online comment form, which is for people who are not parties to the case.",
    "recordRule": "unknown",
    "ruleNote": "The page states no closing date for public comments.",
    "sourceUrl": "https://apsc.arkansas.gov/home/public-comments/"
  },
  AZ: {
    "commentUrl": "https://azcc.gov/arizona-power-plant/FAQs-and-forms",
    "howToComment": "File a letter through the Commission eDocket system or mail it to the Docket Control Center in Phoenix, citing the case number.",
    "recordRule": "unknown",
    "ruleNote": "A written limited appearance statement should be filed at least five business days before the hearing to be admitted as evidence, and the committee hears oral public comment on the first hearing day, but a general cutoff is not stated.",
    "sourceUrl": "https://azcc.gov/arizona-power-plant/FAQs-and-forms"
  },
  CA: {
    "commentUrl": "https://www.cpuc.ca.gov/about-cpuc/divisions/news-and-public-information-office/public-advisors-office/providing-public-comments-at-the-cpuc",
    "howToComment": "Find the proceeding on the CPUC docket card and use Add Public Comment on its Public Comment tab, or mail the Public Advisor's Office in San Francisco.",
    "recordRule": "unknown",
    "ruleNote": "The CPUC pages do not state when public comments stop being accepted; the Energy Commission siting process was not verified.",
    "sourceUrl": "https://www.cpuc.ca.gov/about-cpuc/divisions/news-and-public-information-office/public-advisors-office/providing-public-comments-at-the-cpuc"
  },
  CO: {
    "commentUrl": "",
    "howToComment": "Submit through the PUC online comment portal using the proceeding number, or email dora_puc_comments@state.co.us, or call 303-869-3490.",
    "recordRule": "unknown",
    "ruleNote": "The PUC site blocked automated access (403) and this method came from search summaries, so any comment cutoff is unconfirmed.",
    "sourceUrl": ""
  },
  CT: {
    "commentUrl": "https://portal.ct.gov/CSC/Public-Participation/Public-Participation/Public-Hearing-Participation",
    "howToComment": "Email siting.council@ct.gov or mail a written statement of limited appearance, or speak at the public comment hearing.",
    "recordRule": "varies",
    "ruleNote": "Written comments are due no later than 30 days after the public comment hearing, so the window depends on the hearing date set for each case.",
    "sourceUrl": "https://portal.ct.gov/CSC/Public-Participation/Public-Participation/Public-Hearing-Participation"
  },
  DC: {
    "commentUrl": "https://edocket.dcpsc.org/public/public_comments",
    "howToComment": "Submit a public comment on a formal case through the Commission's eDocket public comments page.",
    "recordRule": "unknown",
    "ruleNote": "The eDocket page content could not be read in detail, so the timing rule is not confirmed.",
    "sourceUrl": ""
  },
  DE: {
    "commentUrl": "https://delafile.delaware.gov/Complaints/AddPublicComments.aspx",
    "howToComment": "Submit the online public comment form in DelaFile with the docket number, or email psc@delaware.gov with the docket number in the subject line.",
    "recordRule": "varies",
    "ruleNote": "Search results indicate comments are due by the deadline in each docket's public notice, but I could not read the notice text to confirm.",
    "sourceUrl": "https://depsc.delaware.gov/"
  },
  FL: {
    "commentUrl": "",
    "howToComment": "Write to the Commission Clerk in Tallahassee or email the Records Clerk, citing the docket number, and the comment is placed in the docket as consumer correspondence.",
    "recordRule": "unknown",
    "ruleNote": "Florida PSC pages returned no readable content to automated fetches, and the method comes from search summaries of filed correspondence, so no deadline is confirmed.",
    "sourceUrl": ""
  },
  GA: {
    "commentUrl": "https://psc.ga.gov/public-comments/",
    "howToComment": "Use the online public comment portal on the Commission website and include the docket number, or speak at the hearing.",
    "recordRule": "open_until_decision",
    "ruleNote": "The Commission page says comments must be submitted 24 hours before a Commission vote, so they are accepted until shortly before the decision.",
    "sourceUrl": "https://psc.ga.gov/public-comments/"
  },
  HI: {
    "commentUrl": "https://puc.hawaii.gov/all-puc-faq/what-are-different-ways-to-get-involved-in-puc-proceedings-2/",
    "howToComment": "Send a public comment through the Commission webform, by mail or in person, and reference the docket number.",
    "recordRule": "open_until_decision",
    "ruleNote": "The Commission accepts public comments on pending docketed proceedings, so comments are taken while the case is open, though no exact cutoff date is stated.",
    "sourceUrl": "https://puc.hawaii.gov/all-puc-faq/what-are-different-ways-to-get-involved-in-puc-proceedings-2/"
  },
  ID: {
    "commentUrl": "https://puc.idaho.gov/Form/CaseComment",
    "howToComment": "Fill out the Case Comment Form on the Commission website with the case number, or email secretary@puc.idaho.gov.",
    "recordRule": "varies",
    "ruleNote": "The form states no deadline and the comment deadline is set in the notice for each case.",
    "sourceUrl": "https://puc.idaho.gov/Form/CaseComment"
  },
  IL: {
    "commentUrl": "https://icc.illinois.gov/consumers/make-a-public-comment",
    "howToComment": "Comment on the case through the ICC eDocket search page, or call 800-524-0795 to have a counselor record your comment.",
    "recordRule": "unknown",
    "ruleNote": "The ICC page gives no deadline or cutoff for public comments.",
    "sourceUrl": "https://icc.illinois.gov/consumers/make-a-public-comment"
  },
  IN: {
    "commentUrl": "https://www.in.gov/oucc/about-your-rates/guide-to-state-utility-regulatory-proceedings/",
    "howToComment": "Send written comments with the cause number to the Office of Utility Consumer Counselor by its online contact page, email or mail, or speak at a field hearing.",
    "recordRule": "unknown",
    "ruleNote": "The consumer counselor invites written comments in all IURC cases but the guide gives no deadline, and the IURC's own comment process was not confirmed.",
    "sourceUrl": "https://www.in.gov/oucc/about-your-rates/guide-to-state-utility-regulatory-proceedings/"
  },
  KS: {
    "commentUrl": "https://www.kcc.ks.gov/public-comments-frequently-asked-questions",
    "howToComment": "Use the Your Opinion Matters link on the KCC website to comment online, or mail a letter citing the docket number to the Office of Public Affairs and Consumer Protection.",
    "recordRule": "closes_at_hearing",
    "ruleNote": "For rate and siting cases the KCC sets a comment period that ends before the evidentiary hearing, and only comments filed by then enter the official record.",
    "sourceUrl": "https://www.kcc.ks.gov/public-comments-frequently-asked-questions"
  },
  KY: {
    "commentUrl": "https://psc.ky.gov/Home/PC",
    "howToComment": "Search for your case on the PSC public comment page and submit your name, contact details and comment online, or speak at the hearing.",
    "recordRule": "open_until_decision",
    "ruleNote": "The PSC says comments filed after a case has closed do not become part of the official record, which implies comments count while the case is open, though no exact cutoff is stated.",
    "sourceUrl": "https://psc.ky.gov/Home/PC"
  },
  LA: {
    "commentUrl": "",
    "howToComment": "The LPSC contact page gives only phone numbers and a mailing address, so call 800-256-2397 or write to the Commission at P.O. Box 91154, Baton Rouge, LA 70821 citing the docket number.",
    "recordRule": "unknown",
    "ruleNote": "Could not find an official public comment page or rule on when comments close.",
    "sourceUrl": ""
  },
  MA: {
    "commentUrl": "",
    "howToComment": "Speak at the public comment hearing or send written comments to the Siting Board presiding officer following the instructions in the case notice (the DPU Siting Division email is sitingboard.filing@mass.gov).",
    "recordRule": "unknown",
    "ruleNote": "The mass.gov pages returned access denied to automated tools and the deadline was not confirmed; each case notice sets its own comment deadline.",
    "sourceUrl": ""
  },
  MD: {
    "commentUrl": "https://psc.maryland.gov/online-services/file-a-public-comment/",
    "howToComment": "Upload a PDF comment through the Commission's Public Comments e-filing system by case number, mail it to the Chief Clerk, or speak at a public comment hearing.",
    "recordRule": "unknown",
    "ruleNote": "The public comment page gives no deadline, so timing must be checked in each case's notice.",
    "sourceUrl": "https://psc.maryland.gov/online-services/file-a-public-comment/"
  },
  ME: {
    "commentUrl": "https://mpuc-cms.maine.gov/CQM.Public.WebUI/Comments/CaseNumberSearch.aspx",
    "howToComment": "Enter the case number in the Maine PUC Case Management System comment page and submit your name, address and comment online.",
    "recordRule": "unknown",
    "ruleNote": "The comment page states no deadline, so it is unclear whether comments count until the hearing or the decision.",
    "sourceUrl": "https://mpuc-cms.maine.gov/CQM.Public.WebUI/Comments/CaseNumberSearch.aspx"
  },
  MI: {
    "commentUrl": "",
    "howToComment": "Open the case in the MPSC e-Dockets system and click Submit Comment, or email mpscedockets@michigan.gov with the case number.",
    "recordRule": "unknown",
    "ruleNote": "Michigan.gov blocked automated access, so this method came only from a search summary and the comment deadline was not confirmed.",
    "sourceUrl": ""
  },
  MN: {
    "commentUrl": "",
    "howToComment": "Comment through the PUC public comments page or eDockets, or email consumer.puc@state.mn.us with the docket number.",
    "recordRule": "unknown",
    "ruleNote": "The mn.gov site blocked automated access, so the method came only from search results and the comment period rules were not confirmed; periods are set by each comment notice.",
    "sourceUrl": ""
  },
  MO: {
    "commentUrl": "https://psc.mo.gov/General/Submit_Comments",
    "howToComment": "Use the online comment form in EFIS, or email pscinfo@psc.mo.gov or mail the Consumer Services Unit with the case number.",
    "recordRule": "unknown",
    "ruleNote": "The page gives no deadline for comments.",
    "sourceUrl": "https://psc.mo.gov/General/Submit_Comments"
  },
  MS: {
    "commentUrl": "",
    "howToComment": "The PSC website does not explain public comment on dockets, so contact the Commission's Executive Secretary in Jackson citing the docket number, or attend a public hearing.",
    "recordRule": "unknown",
    "ruleNote": "The docket and hearings pages contain no public comment procedure or deadline.",
    "sourceUrl": ""
  },
  MT: {
    "commentUrl": "https://psc.mt.gov/Documents-Proceedings/Public-Participation",
    "howToComment": "Submit a comment as a guest in the REDDI online system, mail it to the PSC in Helena, or speak at the start of a public meeting or hearing.",
    "recordRule": "unknown",
    "ruleNote": "The page says comments received before an evidentiary hearing can raise new issues but gives no cutoff.",
    "sourceUrl": "https://psc.mt.gov/Documents-Proceedings/Public-Participation"
  },
  NC: {
    "commentUrl": "https://www.ncuc.gov/contactus.html",
    "howToComment": "Use the consumer statement form on the Commission's Contact Us page with the docket number, or mail a statement to the Commission in Raleigh.",
    "recordRule": "unknown",
    "ruleNote": "The Commission says statements become part of the docket record after two or three business days but does not state a cutoff.",
    "sourceUrl": "https://www.ncuc.gov/contactus.html"
  },
  ND: {
    "commentUrl": "https://www.psc.nd.gov/contact",
    "howToComment": "Email ndpsc@nd.gov or mail the Commission in Bismarck with the case number, or speak at the siting hearing.",
    "recordRule": "closes_at_hearing",
    "ruleNote": "The Commission's siting guide says public comments must be received at the hearing to be part of the official record.",
    "sourceUrl": "https://www.psc.nd.gov/sites/www/files/documents/jurisdiction/siting/PUD-1-Energy-Conversion-Transmission-Siting.pdf"
  },
  NE: {
    "commentUrl": "",
    "howToComment": "The Power Review Board site has no comment procedure, so call the Board at 402-471-2301 or attend the public hearing on the application.",
    "recordRule": "unknown",
    "ruleNote": "No official page on public comment or its timing was found.",
    "sourceUrl": ""
  },
  NH: {
    "commentUrl": "",
    "howToComment": "Send written comments to the Site Evaluation Committee citing the docket number, or call 603-271-2435 for help.",
    "recordRule": "unknown",
    "ruleNote": "NH sites blocked automated access and a search summary said written comments are accepted throughout the proceeding, which I could not verify.",
    "sourceUrl": ""
  },
  NJ: {
    "commentUrl": "https://www.nj.gov/bpu/agenda/efiling/",
    "howToComment": "Find the docket in the Board's Public Document Search tool and use its Post Comments button, or email the Board Secretary at board.secretary@bpu.nj.gov.",
    "recordRule": "varies",
    "ruleNote": "Each Board notice sets its own comment deadline, for example initial and final comment dates for a proceeding.",
    "sourceUrl": "https://www.nj.gov/bpu/pdf/publicnotice/ER26040105-2027%20BGS%20Hearing%20Notice.pdf"
  },
  NM: {
    "commentUrl": "https://www.prc.nm.gov/get-involved/",
    "howToComment": "Submit a public comment with the case number through the PRCe360 portal at e360.prc.nm.gov, or email prc.records@prc.nm.gov.",
    "recordRule": "open_until_decision",
    "ruleNote": "A PRC hearing notice says written comments may be submitted at any time and must cite the case number, and comment is not evidence; no explicit end date was found.",
    "sourceUrl": "https://www.prc.nm.gov/wp-content/uploads/2024/08/24-00207-UT-6-21-24-JK-Notice-of-Proceeding-and-Hearing.pdf"
  },
  NV: {
    "commentUrl": "https://www.puc.nv.gov/consumers/consumer-participation-in-pucn-proceedings",
    "howToComment": "File written comments on the docket through the PUCN electronic filing system, by mail or by hand delivery before the proceeding, or speak at a consumer session.",
    "recordRule": "closes_at_hearing",
    "ruleNote": "Comments must be filed before the scheduled proceeding and are not evidence the Commission may consider in its decision.",
    "sourceUrl": "https://www.puc.nv.gov/consumers/consumer-participation-in-pucn-proceedings"
  },
  NY: {
    "commentUrl": "https://dps.ny.gov/news/public-comment-hearing-set-regarding-st-lawrence-county-solar-facility",
    "howToComment": "Post a comment on the project through the DPS document system (ORES Permit Applications page, Post Comments), or email or mail the Office of Renewable Energy Siting.",
    "recordRule": "varies",
    "ruleNote": "Each project notice sets its own written comment deadline, a day after the public comment hearing in the example checked.",
    "sourceUrl": "https://dps.ny.gov/news/public-comment-hearing-set-regarding-st-lawrence-county-solar-facility"
  },
  OH: {
    "commentUrl": "",
    "howToComment": "Search results indicate comments are filed through the PUCO docketing system under the OPSB case number, but the official pages could not be opened to confirm.",
    "recordRule": "unknown",
    "ruleNote": "The opsb.ohio.gov and puco.ohio.gov pages returned errors to automated access, so nothing was confirmed.",
    "sourceUrl": ""
  },
  OK: {
    "commentUrl": "https://oklahoma.gov/occ/divisions/public-utility/case-public-comments.html",
    "howToComment": "Use the Commission's online Public Comment Form, or email CS@occ.ok.gov or mail the Public Utility Division with the case number.",
    "recordRule": "open_until_decision",
    "ruleNote": "The Commission says any member of the public may submit written comments in the case at any time, though no explicit end date is stated.",
    "sourceUrl": "https://oklahoma.gov/occ/divisions/public-utility/energy/high-voltage-electric-transmission-facility-act/public-participation-in-high-voltage-transmission-applications.html"
  },
  OR: {
    "commentUrl": "https://www.oregon.gov/puc/news-events/pages/get-involved.aspx",
    "howToComment": "Use the online public comment form on the docket in eDockets, or email or mail the Commission with the docket number.",
    "recordRule": "unknown",
    "ruleNote": "The Commission pages describe how to comment but do not state when comments stop counting.",
    "sourceUrl": "https://www.oregon.gov/puc/news-events/pages/get-involved.aspx"
  },
  PA: {
    "commentUrl": "https://www.puc.pa.gov/filing-resources/forms/",
    "howToComment": "Call 1-800-692-7380 or mail the Secretary of the Commission in Harrisburg with the docket number, or speak at a public input hearing.",
    "recordRule": "unknown",
    "ruleNote": "The PUC pages opened did not list a public comment form or a cutoff for comments on a pending case.",
    "sourceUrl": ""
  },
  RI: {
    "commentUrl": "https://ripuc.ri.gov/general-information/efsb",
    "howToComment": "Attend the Energy Facility Siting Board public comment hearing or contact the Board coordinator at 89 Jefferson Boulevard, Warwick.",
    "recordRule": "unknown",
    "ruleNote": "Board notices describe a public comment hearing but no written comment address or cutoff was found.",
    "sourceUrl": "https://ripuc.ri.gov/sites/g/files/xkgbur841/files/2025-09/SB-2025-02%20Notice%20of%20Public%20Comment%20Hearing%20-%20Second%20Hearing%20(002).pdf"
  },
  SC: {
    "commentUrl": "https://www.psc.sc.gov/news/2021-11/psc-seeking-public-comments-docket-no-2021-321-t",
    "howToComment": "Send written comments citing the docket number to the Commission by email to contact@psc.sc.gov or by mail to its Columbia office.",
    "recordRule": "varies",
    "ruleNote": "A Commission notice sets a specific comment deadline for that docket, so the cutoff differs by case.",
    "sourceUrl": "https://www.psc.sc.gov/news/2021-11/psc-seeking-public-comments-docket-no-2021-321-t"
  },
  SD: {
    "commentUrl": "https://puc.sd.gov/contact/guidelines.aspx",
    "howToComment": "Email puc@state.sd.us or mail the Commission in Pierre with the docket number, your name, address and phone.",
    "recordRule": "unknown",
    "ruleNote": "The guide says comments are considered and posted to the docket but gives no cutoff; deadlines are shown in each docket.",
    "sourceUrl": "https://puc.sd.gov/contact/guidelines.aspx"
  },
  TN: {
    "commentUrl": "https://www.tn.gov/tpuc/agency/public-participation-/tpuc-online-public-comment-form.html",
    "howToComment": "Submit written comments through the Commission's online public comment form or in the docket file.",
    "recordRule": "unknown",
    "ruleNote": "A Commission notice gave no written comment deadline, only a comment session and hearing date.",
    "sourceUrl": "https://www.tn.gov/tpuc/news/2025/2/4/commission-schedules-2nd-public-comment-sessions-in-the-limestone-water-utility-rate-case.html"
  },
  TX: {
    "commentUrl": "https://www.puc.texas.gov/agency/rulesnlaws/participate/",
    "howToComment": "Upload a comment under the case's docket number through the PUC Interchange filer, or send it to Central Records.",
    "recordRule": "unknown",
    "ruleNote": "The PUC says comments are entered into the official record but does not state a cutoff.",
    "sourceUrl": "https://www.puc.texas.gov/agency/rulesnlaws/participate/"
  },
  UT: {
    "commentUrl": "https://psc.utah.gov/contactus/",
    "howToComment": "Email psc@utah.gov with the docket number in the subject line, or speak at a public witness hearing.",
    "recordRule": "unknown",
    "ruleNote": "Hearing notices describe public witness hearings and written statements, but no cutoff rule was found.",
    "sourceUrl": ""
  },
  VA: {
    "commentUrl": "https://www.scc.virginia.gov/case-information/submit-public-comments/",
    "howToComment": "Find the case on the SCC public comments page and click Submit Comments, or mail the Clerk of the Commission.",
    "recordRule": "varies",
    "ruleNote": "Each open case lists its own comment deadline on the SCC page.",
    "sourceUrl": "https://www.scc.virginia.gov/case-information/submit-public-comments/"
  },
  VT: {
    "commentUrl": "https://puc.vermont.gov/public-participation/introduction-participating-commission-processes",
    "howToComment": "File a public comment through ePUC on the case page, or send it by email or mail to the Clerk of the Commission.",
    "recordRule": "varies",
    "ruleNote": "The Commission says comment timeframes are set in a scheduling order in each case.",
    "sourceUrl": "https://puc.vermont.gov/public-participation/introduction-participating-commission-processes"
  },
  WA: {
    "commentUrl": "https://efsec.wa.gov/siting-process/get-involved-our-council",
    "howToComment": "Use the Submit comment button on the project page, or email or mail the Energy Facility Site Evaluation Council.",
    "recordRule": "varies",
    "ruleNote": "EFSEC lists open comment periods per project and says you can comment during or after a public hearing.",
    "sourceUrl": "https://efsec.wa.gov/siting-process/get-involved-our-council"
  },
  WI: {
    "commentUrl": "https://psc.wi.gov/Pages/CommissionActions/PublicParticipation.aspx",
    "howToComment": "Use the File a Comment Online tool for a case with an open comment period, or mail the Commission with the docket number.",
    "recordRule": "varies",
    "ruleNote": "The Commission sets a comment filing deadline in each case notice, and comments in that period are part of the record.",
    "sourceUrl": "https://psc.wi.gov/Pages/CommissionActions/PublicParticipation.aspx"
  },
  WV: {
    "commentUrl": "https://www.psc.state.wv.us/scripts/onlinecomments/default.cfm",
    "howToComment": "Use the online public comment form, choose the formal case, and file through the emailed link.",
    "recordRule": "unknown",
    "ruleNote": "The form page gives no deadline or cutoff for comments.",
    "sourceUrl": "https://www.psc.state.wv.us/scripts/onlinecomments/default.cfm"
  },
  WY: {
    "commentUrl": "https://psc.wyo.gov/home/hot-topics",
    "howToComment": "Email wpsc_comments@wyo.gov with the docket or record number, and it is added to the case file.",
    "recordRule": "varies",
    "ruleNote": "The site has no general deadline, and each docket's public notice sets its own comment period.",
    "sourceUrl": "https://psc.wyo.gov/home/hot-topics"
  },
};
