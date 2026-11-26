import type { TileTone } from './tiles';

export type PostLanguage = 'en' | 'hi';

interface LocalisedPost {
  headline: string;
  cta: string;
  caption: string;
}

export interface SamplePost {
  day: 'Mon' | 'Wed' | 'Sat';
  kind: 'Reel' | 'Post';
  tone: TileTone;
  copy: Record<PostLanguage, LocalisedPost>;
}

export interface SampleBusiness {
  id: string;
  label: string;
  shortLabel: string;
  handle: string;
  initials: string;
  posts: [SamplePost, SamplePost, SamplePost];
}

export const kindLabel: Record<PostLanguage, Record<SamplePost['kind'], string>> = {
  en: { Reel: 'Reel', Post: 'Post' },
  hi: { Reel: 'रील', Post: 'पोस्ट' },
};

// Every business, handle and offer here is invented for the landing page.
export const sampleBusinesses: SampleBusiness[] = [
  {
    id: 'bakery',
    label: 'Bakery and sweets',
    shortLabel: 'Sweets',
    handle: '@sharmasweets',
    initials: 'SS',
    posts: [
      {
        day: 'Mon', kind: 'Reel', tone: 'ink',
        copy: {
          en: { headline: 'Kaju katli, made fresh at 6 am', cta: 'Fresh today', caption: 'Made every morning at 6. Order on WhatsApp before 11 for same-day pickup.' },
          hi: { headline: 'काजू कतली, सुबह 6 बजे की ताज़ा', cta: 'आज ताज़ा', caption: 'हर सुबह 6 बजे बनती है। उसी दिन पिकअप के लिए 11 बजे से पहले WhatsApp पर ऑर्डर करें।' },
        },
      },
      {
        day: 'Wed', kind: 'Post', tone: 'sky',
        copy: {
          en: { headline: 'Wedding boxes for every guest list', cta: 'From ₹499', caption: 'Shaadi ki taiyari? Boxes of 12, 24 or 50, packed the way you want.' },
          hi: { headline: 'हर मेहमान के लिए शादी के डिब्बे', cta: '₹499 से', caption: 'शादी की तैयारी? 12, 24 या 50 के डिब्बे, आपकी पसंद से पैक।' },
        },
      },
      {
        day: 'Sat', kind: 'Post', tone: 'navy',
        copy: {
          en: { headline: 'Christmas plum cake is back', cta: 'Pre-order', caption: 'Soaked for six weeks. Pre-order by 20 Dec to get yours.' },
          hi: { headline: 'क्रिसमस प्लम केक फिर आ गया', cta: 'प्री-ऑर्डर करें', caption: 'छह हफ़्ते भिगोया हुआ। 20 दिसंबर तक प्री-ऑर्डर करें।' },
        },
      },
    ],
  },
  {
    id: 'salon',
    label: 'Salon',
    shortLabel: 'Salon',
    handle: '@glowstudio',
    initials: 'GS',
    posts: [
      {
        day: 'Mon', kind: 'Reel', tone: 'ink',
        copy: {
          en: { headline: 'Bridal trial, start to finish', cta: 'Book a trial', caption: 'A full bridal look in 90 seconds. Trials open for December weddings.' },
          hi: { headline: 'ब्राइडल ट्रायल, शुरू से आख़िर तक', cta: 'ट्रायल बुक करें', caption: '90 सेकंड में पूरा ब्राइडल लुक। दिसंबर की शादियों के लिए ट्रायल खुले हैं।' },
        },
      },
      {
        day: 'Wed', kind: 'Post', tone: 'sky',
        copy: {
          en: { headline: 'Weekday hair spa', cta: '₹799', caption: 'Monday to Thursday, 11 am to 4 pm. Walk in or book on WhatsApp.' },
          hi: { headline: 'हफ़्ते के दिनों में हेयर स्पा', cta: '₹799', caption: 'सोमवार से गुरुवार, सुबह 11 से शाम 4 बजे तक। सीधे आएँ या WhatsApp पर बुक करें।' },
        },
      },
      {
        day: 'Sat', kind: 'Post', tone: 'navy',
        copy: {
          en: { headline: 'Party season, sorted', cta: 'Book now', caption: 'Hair and make-up slots for the weekend fill up by Thursday.' },
          hi: { headline: 'पार्टी सीज़न की पूरी तैयारी', cta: 'अभी बुक करें', caption: 'वीकेंड के हेयर और मेकअप स्लॉट गुरुवार तक भर जाते हैं।' },
        },
      },
    ],
  },
  {
    id: 'clinic',
    label: 'Clinic',
    shortLabel: 'Clinic',
    handle: '@careplusclinic',
    initials: 'CP',
    posts: [
      {
        day: 'Mon', kind: 'Post', tone: 'ink',
        copy: {
          en: { headline: 'Sunday OPD is now open', cta: '10 am to 1 pm', caption: 'A general physician is in every Sunday morning. Call to book a slot.' },
          hi: { headline: 'अब रविवार को भी OPD खुली है', cta: 'सुबह 10 से 1', caption: 'हर रविवार सुबह जनरल फ़िज़िशियन मौजूद हैं। स्लॉट के लिए कॉल करें।' },
        },
      },
      {
        day: 'Wed', kind: 'Reel', tone: 'sky',
        copy: {
          en: { headline: 'Meet Dr. Mehta', cta: 'Say hello', caption: 'Twelve years of family practice, and the same calm chat every visit.' },
          hi: { headline: 'मिलिए डॉ. मेहता से', cta: 'नमस्ते कहें', caption: 'बारह साल से परिवारों के डॉक्टर, हर बार वही सुकून भरी बातचीत।' },
        },
      },
      {
        day: 'Sat', kind: 'Post', tone: 'navy',
        copy: {
          en: { headline: 'Time for a winter check-up', cta: 'Book a visit', caption: 'Cold weather is here. Book a routine check-up for the family.' },
          hi: { headline: 'सर्दियों की जाँच का समय', cta: 'विज़िट बुक करें', caption: 'सर्दी आ गई है। परिवार के लिए रूटीन जाँच बुक करें।' },
        },
      },
    ],
  },
  {
    id: 'jewellery',
    label: 'Jewellery',
    shortLabel: 'Jewellery',
    handle: '@rangjewellers',
    initials: 'RJ',
    posts: [
      {
        day: 'Mon', kind: 'Reel', tone: 'ink',
        copy: {
          en: { headline: 'New bridal sets are in', cta: 'See the range', caption: 'Temple, kundan and polki sets, in store from this week.' },
          hi: { headline: 'नए ब्राइडल सेट आ गए', cta: 'पूरी रेंज देखें', caption: 'टेंपल, कुंदन और पोलकी सेट, इसी हफ़्ते से स्टोर में।' },
        },
      },
      {
        day: 'Wed', kind: 'Post', tone: 'sky',
        copy: {
          en: { headline: 'Light gold for every day', cta: 'From ₹8,999', caption: 'Earrings and chains you can wear to work. All hallmarked.' },
          hi: { headline: 'रोज़ पहनने के लिए हल्का सोना', cta: '₹8,999 से', caption: 'ऑफ़िस में पहनने लायक बालियाँ और चेन। सभी हॉलमार्क वाली।' },
        },
      },
      {
        day: 'Sat', kind: 'Post', tone: 'navy',
        copy: {
          en: { headline: 'Old gold exchange', cta: 'Visit us', caption: 'Bring your old jewellery. We weigh and value it in front of you.' },
          hi: { headline: 'पुराने सोने का एक्सचेंज', cta: 'हमसे मिलें', caption: 'अपने पुराने गहने लाएँ। हम आपके सामने तौलकर कीमत बताते हैं।' },
        },
      },
    ],
  },
  {
    id: 'coaching',
    label: 'Coaching',
    shortLabel: 'Coaching',
    handle: '@brightmindsclasses',
    initials: 'BM',
    posts: [
      {
        day: 'Mon', kind: 'Post', tone: 'ink',
        copy: {
          en: { headline: 'New batch for Class 10', cta: 'Starts 2 Jan', caption: 'Maths and Science, evening batch. Twenty seats only.' },
          hi: { headline: 'कक्षा 10 का नया बैच', cta: '2 जनवरी से', caption: 'गणित और विज्ञान, शाम का बैच। सिर्फ़ बीस सीटें।' },
        },
      },
      {
        day: 'Wed', kind: 'Reel', tone: 'sky',
        copy: {
          en: { headline: 'A day in our classroom', cta: 'Free demo class', caption: 'See how a class runs before you join. Demo every Saturday.' },
          hi: { headline: 'हमारी क्लास का एक दिन', cta: 'फ़्री डेमो क्लास', caption: 'जुड़ने से पहले देखें कि क्लास कैसे चलती है। हर शनिवार डेमो।' },
        },
      },
      {
        day: 'Sat', kind: 'Post', tone: 'navy',
        copy: {
          en: { headline: 'Your board exam revision plan', cta: 'Get the plan', caption: 'Sixty days, subject by subject. Message us on WhatsApp for the PDF.' },
          hi: { headline: 'बोर्ड परीक्षा का रिवीज़न प्लान', cta: 'प्लान पाएँ', caption: 'साठ दिन, हर विषय के हिसाब से। PDF के लिए WhatsApp पर मैसेज करें।' },
        },
      },
    ],
  },
  {
    id: 'store',
    label: 'Local store',
    shortLabel: 'Store',
    handle: '@guptakirana',
    initials: 'GK',
    posts: [
      {
        day: 'Mon', kind: 'Post', tone: 'ink',
        copy: {
          en: { headline: 'Fresh stock every morning', cta: 'Home delivery', caption: 'Fruit and vegetables in by 8 am. Free delivery within 2 km.' },
          hi: { headline: 'हर सुबह ताज़ा माल', cta: 'होम डिलीवरी', caption: 'फल और सब्ज़ियाँ सुबह 8 बजे तक। 2 किमी के अंदर फ़्री डिलीवरी।' },
        },
      },
      {
        day: 'Wed', kind: 'Post', tone: 'sky',
        copy: {
          en: { headline: 'Monthly ration, one list', cta: 'Order on WhatsApp', caption: 'Send us your list once. We pack it for you every month.' },
          hi: { headline: 'महीने का राशन, एक लिस्ट', cta: 'WhatsApp पर ऑर्डर', caption: 'एक बार अपनी लिस्ट भेजें। हम हर महीने पैक कर देंगे।' },
        },
      },
      {
        day: 'Sat', kind: 'Reel', tone: 'navy',
        copy: {
          en: { headline: 'Sunday saver deals', cta: 'This Sunday', caption: 'Oil, atta and dal at weekend prices, while stocks last.' },
          hi: { headline: 'संडे सेवर ऑफ़र', cta: 'इस रविवार', caption: 'तेल, आटा और दाल वीकेंड की कीमत पर, स्टॉक रहने तक।' },
        },
      },
    ],
  },
];
