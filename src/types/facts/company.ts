import type { Field } from './envelope'

export interface CompanyFacts {
  legalName: Field<string>
  cin: Field<string>
  incorporationDate: Field<string>
  registeredOfficeAddress: Field<string>
  industry: Field<string>
  businessDescription: Field<string>
}
