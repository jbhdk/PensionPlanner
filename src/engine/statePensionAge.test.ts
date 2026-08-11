import { describe, expect, it } from 'vitest'
import { aPlan } from './testing/planFixture'
import { deriveStatePensionAge, statePensionAge } from './statePensionAge'

describe('deriveStatePensionAge', () => {
  it('udleder folkepensionsalderen for en fødselsdato midt i et vedtaget trin', () => {
    expect(deriveStatePensionAge(1973, 6)).toEqual({ age: 70, enacted: true })
  })

  it('rammer den rigtige måned, når et trin skifter midt i et fødselsår', () => {
    expect(deriveStatePensionAge(1955, 6)).toEqual({ age: 66.5, enacted: true })
    expect(deriveStatePensionAge(1955, 7)).toEqual({ age: 67, enacted: true })
  })

  it('markerer fødselsår efter det sidst vedtagne trin som et skøn', () => {
    expect(deriveStatePensionAge(1985, 1)).toEqual({ age: 72.5, enacted: false })
  })

  it('bruger det sidste kendte trin for fødselsår efter den offentliggjorte fremskrivning', () => {
    expect(deriveStatePensionAge(2010, 1)).toEqual({ age: 74, enacted: false })
  })
})

describe('statePensionAge', () => {
  it('bruger den udledte alder, når personen ikke har en overstyring', () => {
    const [person] = aPlan({ birthYear: 1973 }).household.persons
    expect(statePensionAge(person!)).toBe(70)
  })

  it('lader en overstyring vinde over den udledte alder', () => {
    const [person] = aPlan({ birthYear: 1985 }).household.persons
    expect(statePensionAge({ ...person!, statePensionAgeOverride: 72 })).toBe(72)
  })
})
