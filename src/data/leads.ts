import { Lead } from '../types';

export const leads: Lead[] = [
  {
    id: 'lead-1',
    name: 'Maya Rosenberg',
    listing: '212 Bedford Ave #3F, Williamsburg',
    source: 'StreetEasy',
    receivedAt: 'Today 9:41 AM',
    summary: 'Wants a tour this week, moving with one roommate, flexible on floor.',
    income: '~$145k combined',
    credit: '750+',
    availability: 'Weekday evenings after 6 PM · Target move-in Sep 1',
    email: 'maya.rosenberg@gmail.com',
    phone: '(917) 555-0164',
    emailBody: `Hi,

I came across your listing for 212 Bedford Ave #3F on StreetEasy and I'm very interested. My roommate and I are looking to move by September 1st.

A bit about us: I work in product marketing at a fintech company ($95k) and my roommate is a nurse at NYU Langone ($50k). Both credit scores are above 750 and we have complete documents ready to go (pay stubs, tax returns, bank statements).

Would it be possible to see the apartment this week? I'm free most weekday evenings after 6pm, and pretty much any time this weekend.

Thanks so much,
Maya Rosenberg
(917) 555-0164`,
  },
  {
    id: 'lead-2',
    name: 'Dev Patel',
    listing: '88 Havemeyer St #2B, Williamsburg',
    source: 'Zillow',
    receivedAt: 'Today 8:15 AM',
    summary: 'Relocating from Chicago for a new job, needs virtual tour first.',
    income: '$180k',
    credit: '"excellent" (self-reported)',
    availability: 'Virtual tour any day · In NYC July 18–20 · Move-in Aug 1',
    email: 'dev.patel.chi@outlook.com',
    phone: '(312) 555-0142',
    emailBody: `Hello,

I'm relocating to New York from Chicago in August for a new role as a senior software engineer (base $180k). I saw 88 Havemeyer St #2B on Zillow and it looks perfect.

Since I'm out of state, could we start with a virtual tour? I'll be in the city July 18-20 and could see it in person then, and I'm ready to apply immediately if it checks out. Excellent credit, no pets, non-smoker.

Is the apartment still available for an August 1 move-in?

Best,
Dev Patel
(312) 555-0142`,
  },
  {
    id: 'lead-3',
    name: 'Carolina Vasquez',
    listing: '301 Graham Ave #4A, East Williamsburg',
    source: 'StreetEasy',
    receivedAt: 'Yesterday 7:52 PM',
    summary: 'Asked if the unit is pet-friendly (one small dog) and about laundry.',
    income: '~$110k',
    availability: 'Weekends preferred · Flexible move-in Aug–Sep',
    email: 'carolina.vsq@gmail.com',
    phone: '(646) 555-0189',
    emailBody: `Hi there,

I'm interested in 301 Graham Ave #4A. Before scheduling a viewing I have two quick questions:

1. Is the building pet-friendly? I have a 12 lb mini poodle, very quiet.
2. Is there laundry in the building or in the unit?

I'm a graphic designer at an agency in Manhattan making about $110k, and my parents can co-sign if needed. My timing is flexible — anytime between August and September works.

Weekends are best for me to view.

Thank you!
Carolina Vasquez
(646) 555-0189`,
  },
  {
    id: 'lead-4',
    name: 'Tom & Erin Walsh',
    listing: '1601 Ocean Ave #6C, Midwood',
    source: 'Zillow',
    receivedAt: 'Yesterday 3:20 PM',
    summary: 'Couple expecting a baby, want a quiet 2BR, asked about school zone.',
    income: '$195k combined',
    credit: '780 / 765',
    availability: 'Sat/Sun mornings · Need move-in by Oct 1',
    email: 'walsh.family.ny@gmail.com',
    phone: '(718) 555-0113',
    // Landed in Daniel's inbox, not Harry's — replies to this lead go out
    // from Daniel once his Gmail is connected in Shared Access.
    receivedByEmail: 'daniel@brooklyngroup.com',
    emailBody: `Hello,

My wife and I saw your listing for 1601 Ocean Ave #6C on Zillow. We're expecting our first child in November and are looking for a quiet two-bedroom in the area — this one looks great.

Couple of questions: how is street noise on the 6th floor, and do you know which school district the building is zoned for?

We're both employed full time (combined $195k, credit 780 and 765) and would need to move in by October 1 at the latest.

Saturday or Sunday mornings are ideal for us to come see it.

Thanks,
Tom & Erin Walsh
(718) 555-0113`,
  },
  {
    id: 'lead-5',
    name: 'Jordan Kim',
    listing: '212 Bedford Ave #5A, Williamsburg',
    source: 'StreetEasy',
    receivedAt: 'Yesterday 11:05 AM',
    summary: 'First apartment out of college, parents will guarantee the lease.',
    income: '$72k (starting salary)',
    availability: 'Any day after 5 PM · Wants Aug 15 move-in',
    email: 'jordankim01@gmail.com',
    phone: '(201) 555-0177',
    emailBody: `Hi!

I just graduated and I'm starting as an analyst at a bank downtown in August ($72k starting). I saw the studio at 212 Bedford Ave #5A and I love the location.

I know my income alone may not hit 40x — my parents are happy to be guarantors (they make around $400k combined and own their home).

Could I see it any weekday after 5pm? Hoping to move in around August 15.

Thank you!
Jordan Kim
(201) 555-0177`,
  },
  {
    id: 'lead-6',
    name: 'Aisha Bello',
    listing: '450 Nostrand Ave #3R, Bed-Stuy',
    source: 'StreetEasy',
    receivedAt: 'Tue 4:47 PM',
    summary: 'Asked about net effective vs gross rent and lease length options.',
    income: '$128k',
    credit: '720',
    availability: 'Thu/Fri evenings or Sat · Move-in Sep 1 firm',
    email: 'aisha.bello.md@gmail.com',
    phone: '(347) 555-0158',
    emailBody: `Good afternoon,

I'm interested in 450 Nostrand Ave #3R. The listing shows a net effective rent — could you confirm the gross monthly rent and whether a 12- or 24-month lease is possible? I'd rather pay the real number monthly than deal with a free-month calculation.

I'm a resident physician at Kings County ($128k with moonlighting), credit around 720, documents ready.

I could view Thursday or Friday evening, or Saturday during the day. My move-in date is September 1 — that part is firm.

Best regards,
Aisha Bello
(347) 555-0158`,
  },
  {
    id: 'lead-7',
    name: 'Nick Antonelli',
    listing: '145 Driggs Ave #1F, Greenpoint',
    source: 'Zillow',
    receivedAt: 'Tue 10:12 AM',
    summary: 'Wants ASAP move-in, asked if first month + security is enough to hold it.',
    income: '"6 figures" (self-reported)',
    credit: 'unknown',
    availability: 'Available anytime, "can come today" · ASAP move-in',
    email: 'nickantonelli88@yahoo.com',
    phone: '(929) 555-0102',
    emailBody: `Hey,

Saw the place at 145 Driggs Ave #1F on Zillow. I need something ASAP — my current lease ends this month. I make 6 figures and can put down first month + security same day to lock it in. Can I come by today or tomorrow?

Also is the fee negotiable if I sign fast?

Nick
(929) 555-0102`,
  },
  {
    id: 'lead-8',
    name: 'Priya & Sam Mehta',
    listing: '77 Clarkson Ave #PH2, Prospect-Lefferts',
    source: 'StreetEasy',
    receivedAt: 'Mon 6:30 PM',
    summary: 'Repeat renters upgrading to a 3BR, asked about parking and roof access.',
    income: '$240k combined',
    credit: '790 / 775',
    availability: 'Weekends only · Flexible Sep–Oct move-in',
    email: 'mehta.priya.s@gmail.com',
    phone: '(917) 555-0136',
    receivedByEmail: 'daniel@brooklyngroup.com',
    emailBody: `Hi,

We currently rent a 2BR nearby and saw the penthouse at 77 Clarkson Ave #PH2 on StreetEasy — we're looking to upgrade to a 3BR before the fall.

Questions:
- Is there parking available in the building or nearby monthly lots?
- Does the penthouse come with private roof access, or is the roof shared?

We're both attorneys (combined ~$240k, credit 790 and 775), no pets, current landlord will give a reference.

We can only view on weekends. Move-in is flexible anywhere September to October.

Thanks!
Priya & Sam Mehta
(917) 555-0136`,
  },
  {
    id: 'lead-9',
    name: 'Wei Chen',
    listing: '58 North 6th St #4B, Williamsburg',
    source: 'StreetEasy',
    receivedAt: 'Today 7:02 AM',
    summary: 'Relocating for a new job at a trading firm, wants to lock something down fast.',
    income: '$210k',
    credit: '805',
    availability: 'Any day, any time — fully flexible · Move-in ASAP',
    email: 'wei.chen.nyc@gmail.com',
    phone: '(646) 555-0221',
    emailBody: `Hi,

I just accepted an offer at a trading firm in the city and start in two weeks. Saw 58 North 6th St #4B on StreetEasy and it looks like exactly what I need — close to the office, good layout.

I'm flexible on timing for a viewing, whatever works on your end. Credit is 805, income $210k, happy to send pay stubs and an offer letter right away. Would like to move fast if it's still available.

Thanks,
Wei Chen
(646) 555-0221`,
  },
  {
    id: 'lead-10',
    name: 'Fatima Al-Rashid',
    listing: '58 North 6th St #4B, Williamsburg',
    source: 'Zillow',
    receivedAt: 'Today 6:40 AM',
    summary: 'Comparing this to two other listings, asked about broker fee and who pays it.',
    income: '$132k',
    credit: '760',
    availability: 'Tue/Thu after 4 PM · Move-in flexible, Sep–Oct',
    email: 'f.alrashid@proton.me',
    phone: '(347) 555-0290',
    emailBody: `Hello,

I'm looking at a few places this week including 58 North 6th St #4B. Before I schedule a viewing — is this a broker fee or no-fee listing, and if there's a fee, is it paid by the tenant or the landlord?

I'm comparing a couple of options so trying to understand the real all-in cost before committing time to a tour. Income $132k, credit 760, no pets, no guarantor needed.

Available Tuesday or Thursday after 4pm this week or next. Move-in is flexible, sometime September to October.

Best,
Fatima Al-Rashid
(347) 555-0290`,
  },
  {
    id: 'lead-11',
    name: 'Ben & Julia Foster',
    listing: '210 Nassau Ave #1C, Greenpoint',
    source: 'StreetEasy',
    receivedAt: 'Yesterday 5:18 PM',
    summary: 'Newlyweds, first place together, asked if the gross rent includes heat/hot water.',
    income: '$165k combined',
    credit: '735 / 741',
    availability: 'Weekday mornings before 10 AM · Move-in Sep 1',
    email: 'benandjuliafoster@gmail.com',
    phone: '(203) 555-0117',
    // Landed in Daniel's inbox, not Harry's.
    receivedByEmail: 'daniel@brooklyngroup.com',
    emailBody: `Hi there,

My husband and I are getting our first place together and 210 Nassau Ave #1C caught our eye. Quick question before we book a tour: does the gross rent listed include heat and hot water, or is that separate?

Combined income is $165k, credit 735 and 741, both W2 employed, no pets. We're both early risers so weekday mornings before 10am work best for us if that's possible.

Hoping for a September 1 move-in if this ends up being the one.

Thanks so much,
Ben & Julia Foster
(203) 555-0117`,
  },
  {
    id: 'lead-12',
    name: 'Marcus Bell',
    listing: '301 Graham Ave #4A, East Williamsburg',
    source: 'Zillow',
    receivedAt: 'Yesterday 2:11 PM',
    summary: 'Uses a housing voucher (Section 8), asked if the building participates.',
    income: '$58k + voucher',
    availability: 'Flexible on days, needs 48 hrs notice · Move-in whenever ready',
    email: 'marcus.bell82@gmail.com',
    phone: '(718) 555-0244',
    emailBody: `Hello,

I'm interested in 301 Graham Ave #4A. I work full time ($58k) and also have a Section 8 housing voucher that would cover part of the rent — does this building/landlord participate in the voucher program?

Happy to provide voucher paperwork and income verification. I can view most days but need about 48 hours notice to arrange time off work.

Thank you for your time,
Marcus Bell
(718) 555-0244`,
  },
  {
    id: 'lead-13',
    name: 'Sofia Greco',
    listing: '88 Havemeyer St #4D, Williamsburg',
    source: 'StreetEasy',
    receivedAt: 'Yesterday 9:30 AM',
    summary: 'Very short inquiry — just asked if it\'s still available.',
    income: 'Not stated',
    availability: 'Not stated',
    email: 'sofia.greco90@gmail.com',
    phone: '(917) 555-0311',
    emailBody: `Hi is this still available? Thanks, Sofia`,
  },
  {
    id: 'lead-14',
    name: 'Robert & Linda Hutchins',
    listing: '77 Clarkson Ave #5E, Prospect-Lefferts',
    source: 'Zillow',
    receivedAt: '2 days ago 4:55 PM',
    summary: 'Guarantor situation for their daughter, lots of detail, wants everything in writing.',
    income: 'Daughter $61k + parents guarantee $410k combined',
    credit: 'Daughter 690 / Parents 800+',
    availability: 'Daughter available anytime · Parents need 1 week notice to fly in',
    email: 'rhutchins.family@gmail.com',
    phone: '(508) 555-0166',
    emailBody: `To whom it may concern,

We are writing on behalf of our daughter, who is interested in 77 Clarkson Ave #5E. She recently started her first job out of graduate school ($61k) and while she is fully capable of managing rent payments, we understand her income alone may not satisfy the standard 40x rent requirement, so we would like to offer to guarantee the lease.

Some background: we are both retired with a combined guaranteed income (pension + investments) of approximately $410k annually, credit scores above 800 for both of us, and we have guaranteed leases for her twice before in a different city with no issues — happy to provide those landlord references.

Our daughter is local and available to view anytime that works for you. We are out of state and would need about a week's notice to fly in if an in-person guarantor meeting or additional paperwork is required, though we're also comfortable handling everything remotely/electronically if that's an option.

Please let us know what documentation you'd need from us to move forward, and whether a guarantor in our situation is something the landlord typically accepts.

Thank you for your time and we look forward to hearing from you.

Robert & Linda Hutchins
(508) 555-0166`,
  },
  {
    id: 'lead-15',
    name: 'Ola Adeyemi',
    listing: '1601 Ocean Ave #2A, Midwood',
    source: 'StreetEasy',
    receivedAt: '2 days ago 11:20 AM',
    summary: 'Relocating from London for work, no US credit history yet.',
    income: '£95k (~$120k)',
    credit: 'No U.S. credit history — new to the country',
    availability: 'Virtual tour preferred · In NYC starting Aug 10',
    email: 'ola.adeyemi.work@gmail.com',
    phone: '+44 7700 900312',
    emailBody: `Hello,

I'm relocating to New York from London for work and start August 10th. I came across 1601 Ocean Ave #2A and I'm quite interested, though I do have a slightly unusual situation: I don't yet have a U.S. credit history since I've been abroad.

My income is stable (£95k, roughly $120k), I can provide employer verification, bank statements, and would be open to a larger security deposit or prepaying several months if that helps offset the lack of credit history.

Would it be possible to do a virtual tour before I land? I'll be in New York in person starting August 10th if an in-person visit or paperwork signing is needed then.

Kind regards,
Ola Adeyemi
+44 7700 900312`,
  },
  {
    id: 'lead-16',
    name: 'Danny Ruiz',
    listing: '145 Driggs Ave #1F, Greenpoint',
    source: 'Zillow',
    receivedAt: '3 days ago 8:03 PM',
    summary: 'Asked to reschedule twice already, seems interested but flaky on timing.',
    income: '$98k',
    credit: '702',
    availability: 'Says "probably weekends" · Has canceled twice already',
    email: 'druiz.bk@gmail.com',
    phone: '(929) 555-0388',
    emailBody: `hey sorry for the back and forth — work has been crazy. still very interested in 145 Driggs Ave #1F, can we try to find a time this weekend that actually sticks? my bad again

income is 98k, credit around 702 last I checked

Danny`,
  },
];
