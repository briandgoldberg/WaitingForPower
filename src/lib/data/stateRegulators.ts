// Public regulator directory for the Advocacy > State tab and each project's
// "Take action" block: the state agency that regulates or sites energy
// projects, its official website, and its official contact page where one
// exists. Every URL was checked live (2026-09-20); AK, MA and NH sites answer
// automated checks with 403 (bot blocking) but are the agencies' real sites.
// Deliberately no phone numbers or staff emails, which go stale.
// Where a state has a separate siting board, it's a second entry.

export interface Regulator {
  name: string;
  website: string;
  contactUrl?: string;
}

export const STATE_REGULATORS: Record<string, Regulator[]> = {
  AL: [
    { name: "Alabama Public Service Commission", website: "https://psc.alabama.gov", contactUrl: "https://psc.alabama.gov/contacts/" },
  ],
  AK: [
    { name: "Regulatory Commission of Alaska", website: "https://rca.alaska.gov" },
  ],
  AZ: [
    { name: "Arizona Corporation Commission", website: "https://azcc.gov", contactUrl: "https://azcc.gov/contact" },
  ],
  AR: [
    { name: "Arkansas Public Service Commission", website: "https://apsc.arkansas.gov" },
  ],
  CA: [
    { name: "California Public Utilities Commission", website: "https://www.cpuc.ca.gov", contactUrl: "https://www.cpuc.ca.gov/about-cpuc/contacting-the-puc" },
    { name: "California Energy Commission", website: "https://www.energy.ca.gov", contactUrl: "https://www.energy.ca.gov/contact" },
  ],
  CO: [
    { name: "Colorado Public Utilities Commission", website: "https://puc.colorado.gov", contactUrl: "https://puc.colorado.gov/about-the-puc/contact-the-puc" },
  ],
  CT: [
    { name: "Connecticut Public Utilities Regulatory Authority", website: "https://portal.ct.gov/pura", contactUrl: "https://portal.ct.gov/pura/about/contact-us" },
    { name: "Connecticut Siting Council", website: "https://portal.ct.gov/csc", contactUrl: "https://portal.ct.gov/csc/meetings-and-minutes/common-elements/contact-us" },
  ],
  DE: [
    { name: "Delaware Public Service Commission", website: "https://depsc.delaware.gov" },
  ],
  DC: [
    { name: "District of Columbia Public Service Commission", website: "https://dcpsc.org", contactUrl: "https://dcpsc.org/About-PSC/About-the-Commission/Contact-Us.aspx" },
  ],
  FL: [
    { name: "Florida Public Service Commission", website: "https://www.floridapsc.com" },
  ],
  GA: [
    { name: "Georgia Public Service Commission", website: "https://psc.ga.gov" },
  ],
  HI: [
    { name: "Hawaii Public Utilities Commission", website: "https://puc.hawaii.gov", contactUrl: "https://puc.hawaii.gov/contact/" },
  ],
  ID: [
    { name: "Idaho Public Utilities Commission", website: "https://puc.idaho.gov", contactUrl: "https://puc.idaho.gov/Home/Contact" },
  ],
  IL: [
    { name: "Illinois Commerce Commission", website: "https://icc.illinois.gov", contactUrl: "https://icc.illinois.gov/about/contact-us" },
  ],
  IN: [
    { name: "Indiana Utility Regulatory Commission", website: "https://www.in.gov/iurc", contactUrl: "https://www.in.gov/iurc/contact-us" },
  ],
  IA: [
    { name: "Iowa Utilities Commission", website: "https://iuc.iowa.gov", contactUrl: "https://iuc.iowa.gov/about/contact-us" },
  ],
  KS: [
    { name: "Kansas Corporation Commission", website: "https://www.kcc.ks.gov", contactUrl: "https://www.kcc.ks.gov/contact-us" },
  ],
  KY: [
    { name: "Kentucky Public Service Commission", website: "https://psc.ky.gov", contactUrl: "https://psc.ky.gov/Home/Contact" },
  ],
  LA: [
    { name: "Louisiana Public Service Commission", website: "https://www.lpsc.louisiana.gov", contactUrl: "https://www.lpsc.louisiana.gov/Contact" },
  ],
  ME: [
    { name: "Maine Public Utilities Commission", website: "https://www.maine.gov/mpuc", contactUrl: "https://www.maine.gov/mpuc/about/contact" },
    { name: "Maine Department of Environmental Protection", website: "https://www.maine.gov/dep", contactUrl: "https://www.maine.gov/dep/contact/index.html" },
  ],
  MD: [
    { name: "Maryland Public Service Commission", website: "https://psc.maryland.gov", contactUrl: "https://psc.maryland.gov/contact/" },
  ],
  MA: [
    { name: "Massachusetts Department of Public Utilities", website: "https://www.mass.gov/orgs/department-of-public-utilities" },
    { name: "Massachusetts Energy Facilities Siting Board", website: "https://www.mass.gov/orgs/energy-facilities-siting-board" },
  ],
  MI: [
    { name: "Michigan Public Service Commission", website: "https://www.michigan.gov/mpsc" },
  ],
  MN: [
    { name: "Minnesota Public Utilities Commission", website: "https://mn.gov/puc", contactUrl: "https://mn.gov/puc/about-us/contact-us/index.jsp" },
  ],
  MS: [
    { name: "Mississippi Public Service Commission", website: "https://www.psc.ms.gov" },
  ],
  MO: [
    { name: "Missouri Public Service Commission", website: "https://psc.mo.gov", contactUrl: "https://psc.mo.gov/General/Contact_Us" },
  ],
  MT: [
    { name: "Montana Public Service Commission", website: "https://psc.mt.gov" },
  ],
  NE: [
    { name: "Nebraska Power Review Board", website: "https://powerreview.nebraska.gov" },
  ],
  NV: [
    { name: "Public Utilities Commission of Nevada", website: "https://www.puc.nv.gov", contactUrl: "https://www.puc.nv.gov/contact2/" },
  ],
  NH: [
    { name: "New Hampshire Public Utilities Commission", website: "https://www.puc.nh.gov" },
    { name: "New Hampshire Site Evaluation Committee", website: "https://www.nhsec.nh.gov" },
  ],
  NJ: [
    { name: "New Jersey Board of Public Utilities", website: "https://www.nj.gov/bpu", contactUrl: "https://www.nj.gov/bpu/about/contact" },
  ],
  NM: [
    { name: "New Mexico Public Regulation Commission", website: "https://www.prc.nm.gov", contactUrl: "https://www.prc.nm.gov/administrative-services/contact-us/" },
  ],
  NY: [
    { name: "New York Department of Public Service", website: "https://dps.ny.gov", contactUrl: "https://dps.ny.gov/contact-us" },
  ],
  NC: [
    { name: "North Carolina Utilities Commission", website: "https://www.ncuc.gov", contactUrl: "https://www.ncuc.gov/contactus.html" },
  ],
  ND: [
    { name: "North Dakota Public Service Commission", website: "https://www.psc.nd.gov", contactUrl: "https://www.psc.nd.gov/contact" },
  ],
  OH: [
    { name: "Public Utilities Commission of Ohio", website: "https://puco.ohio.gov" },
    { name: "Ohio Power Siting Board", website: "https://opsb.ohio.gov" },
  ],
  OK: [
    { name: "Oklahoma Corporation Commission", website: "https://oklahoma.gov/occ.html", contactUrl: "https://oklahoma.gov/occ/about/contact-us.html" },
  ],
  OR: [
    { name: "Oregon Public Utility Commission", website: "https://www.oregon.gov/puc", contactUrl: "https://www.oregon.gov/puc/about-us/Pages/Contact-Us.aspx" },
    { name: "Oregon Energy Facility Siting Council", website: "https://www.oregon.gov/energy", contactUrl: "https://www.oregon.gov/energy/about-us/Pages/contact-us.aspx" },
  ],
  PA: [
    { name: "Pennsylvania Public Utility Commission", website: "https://www.puc.pa.gov" },
  ],
  RI: [
    { name: "Rhode Island Public Utilities Commission", website: "https://ripuc.ri.gov", contactUrl: "https://ripuc.ri.gov/general-information/staff-directory" },
  ],
  SC: [
    { name: "South Carolina Public Service Commission", website: "https://psc.sc.gov" },
  ],
  SD: [
    { name: "South Dakota Public Utilities Commission", website: "https://puc.sd.gov", contactUrl: "https://puc.sd.gov/contact/" },
  ],
  TN: [
    { name: "Tennessee Public Utility Commission", website: "https://www.tn.gov/tpuc" },
  ],
  TX: [
    { name: "Public Utility Commission of Texas", website: "https://www.puc.texas.gov", contactUrl: "https://www.puc.texas.gov/agency/about/contact/" },
  ],
  UT: [
    { name: "Utah Public Service Commission", website: "https://psc.utah.gov", contactUrl: "https://psc.utah.gov/contactus/" },
  ],
  VT: [
    { name: "Vermont Public Utility Commission", website: "https://puc.vermont.gov" },
  ],
  VA: [
    { name: "Virginia State Corporation Commission", website: "https://www.scc.virginia.gov", contactUrl: "https://www.scc.virginia.gov/about-the-scc/contact-us/" },
  ],
  WA: [
    { name: "Washington Utilities and Transportation Commission", website: "https://www.utc.wa.gov", contactUrl: "https://www.utc.wa.gov/contact-us" },
    { name: "Washington Energy Facility Site Evaluation Council", website: "https://efsec.wa.gov", contactUrl: "https://efsec.wa.gov/contact-us" },
  ],
  WV: [
    { name: "West Virginia Public Service Commission", website: "https://www.psc.state.wv.us" },
  ],
  WI: [
    { name: "Public Service Commission of Wisconsin", website: "https://psc.wi.gov", contactUrl: "https://psc.wi.gov/Pages/AboutPSC/ContactUs.aspx" },
  ],
  WY: [
    { name: "Wyoming Public Service Commission", website: "https://psc.wyo.gov", contactUrl: "https://psc.wyo.gov/about-us/contact-us" },
  ],
};
