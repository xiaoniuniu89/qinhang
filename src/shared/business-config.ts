/**
 * Business configuration for multi-tenant support
 *
 * This file defines the structure for business/school-specific configuration.
 * Each teacher or music school can have their own config loaded via environment variables.
 */

export interface BusinessContact {
  email: string
  phone: string
  whatsapp: {
    number: string // E.164 format (e.g., "353857267963")
    defaultMessage: {
      en: string
      zh?: string
    }
  }
}

export interface BusinessInfo {
  name: string
  teacherName: string
  location: {
    city: string
    region: string
    country: string
  }
  languages: string[] // e.g., ["en", "zh"]
  specialties: string[]
}

export interface LessonPricing {
  currency: string
  individual: {
    price: number
    duration: number // minutes
    description: {
      en: string
      zh?: string
    }
  }
  group?: {
    price: number
    duration: number // minutes
    minStudents: number
    maxStudents: number
    description: {
      en: string
      zh?: string
    }
  }
}

export interface BusinessTheme {
  primaryColor: string // e.g., "#4CAF50"
  secondaryColor?: string
  brandName: string
}

export interface BusinessConfig {
  contact: BusinessContact
  info: BusinessInfo
  pricing: LessonPricing
  theme: BusinessTheme
  features: {
    emailBooking: boolean
    whatsappBooking: boolean
    calendarIntegration: boolean
    onlinePayments: boolean
  }
}

/**
 * Default configuration for CC Piano (Chenyang Zhao)
 * This can be overridden via environment variables or a separate config file
 */
export const defaultBusinessConfig: BusinessConfig = {
  contact: {
    email: process.env.BUSINESS_EMAIL || 'ccpiano@example.com',
    phone: process.env.BUSINESS_PHONE || '+353 85 726 7963',
    whatsapp: {
      number: process.env.WHATSAPP_NUMBER || '353857267963',
      defaultMessage: {
        en: "Hi, I'd like to inquire about piano lessons",
        zh: "你好，我想咨询钢琴课程"
      }
    }
  },
  info: {
    name: process.env.BUSINESS_NAME || 'CC Piano',
    teacherName: process.env.TEACHER_NAME || 'Chenyang Zhao (CC)',
    location: {
      city: process.env.BUSINESS_CITY || 'Kinnegad, Mullingar',
      region: process.env.BUSINESS_REGION || 'Westmeath',
      country: process.env.BUSINESS_COUNTRY || 'Ireland'
    },
    languages: ['en', 'zh'],
    specialties: ['RIAM Exam Preparation', 'ABRSM Exam Preparation', 'Junior Cert', 'Leaving Cert']
  },
  pricing: {
    currency: process.env.PRICING_CURRENCY || 'EUR',
    individual: {
      price: Number(process.env.PRICE_INDIVIDUAL) || 40,
      duration: 60,
      description: {
        en: '60-minute individual lesson',
        zh: '60分钟一对一课程'
      }
    },
    group: {
      price: Number(process.env.PRICE_GROUP) || 25,
      duration: 60,
      minStudents: 2,
      maxStudents: 4,
      description: {
        en: '60-minute group lesson (2-4 students)',
        zh: '60分钟小组课程（2-4名学生）'
      }
    }
  },
  theme: {
    primaryColor: process.env.THEME_PRIMARY_COLOR || '#4CAF50',
    secondaryColor: process.env.THEME_SECONDARY_COLOR || '#45a049',
    brandName: process.env.BRAND_NAME || 'CODA'
  },
  features: {
    emailBooking: process.env.FEATURE_EMAIL_BOOKING !== 'false',
    whatsappBooking: process.env.FEATURE_WHATSAPP_BOOKING !== 'false',
    calendarIntegration: process.env.FEATURE_CALENDAR_INTEGRATION === 'true',
    onlinePayments: process.env.FEATURE_ONLINE_PAYMENTS === 'true'
  }
}

/**
 * Get the active business configuration
 * This function can be extended to support multiple configs or database-driven configs
 */
export function getBusinessConfig(): BusinessConfig {
  // In the future, this could:
  // 1. Load from database based on subdomain/tenant ID
  // 2. Load from a JSON config file
  // 3. Support multiple teachers/schools

  return defaultBusinessConfig
}
