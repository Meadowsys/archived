/** @babel */

import etch from 'etch'
import IncompatiblePackagesComponent from '../lib/incompatible-packages-component'

describe('IncompatiblePackagesComponent', () => {
  let packages, etchScheduler

  beforeEach(() => {
    etchScheduler = etch.getScheduler()

    packages = [
      {
        name: 'incompatible-1',
        isCompatible () {
          return false
        },
        rebuild: function () {
          return new Promise((resolve) => this.resolveRebuild = resolve)
        },
        getBuildFailureOutput () {
          return null
        },
        path: '/Users/joe/.atom/packages/incompatible-1',
        metadata: {
          repository: 'https://github.com/atom/incompatible-1',
          version: '1.0.0'
        },
        incompatibleModules: [
          {name: 'x', version: '1.0.0', error: 'Expected version X, got Y'},
          {name: 'y', version: '1.0.0', error: 'Expected version X, got Z'}
        ]
      },
      {
        name: 'incompatible-2',
        isCompatible () {
          return false
        },
        rebuild () {
          return new Promise((resolve) => this.resolveRebuild = resolve)
        },
        getBuildFailureOutput () {
          return null
        },
        path: '/Users/joe/.atom/packages/incompatible-2',
        metadata: {
          repository: 'https://github.com/atom/incompatible-2',
          version: '1.0.0'
        },
        incompatibleModules: [
          {name: 'z', version: '1.0.0', error: 'Expected version X, got Y'}
        ]
      },
      {
        name: 'compatible',
        isCompatible () {
          return true
        },
        rebuild () {
          throw new Error('Should not rebuild a compatible package')
        },
        getBuildFailureOutput () {
          return null
        },
        path: '/Users/joe/.atom/packages/b',
        metadata: {
          repository: 'https://github.com/atom/b',
          version: '1.0.0'
        },
        incompatibleModules: [],
      }
    ]
  })

  describe('when packages have not finished loading', () => {
    it('delays rendering incompatible packages until the end of the tick', () => {
      waitsForPromise(async () => {
        let component =
          new IncompatiblePackagesComponent({
            getActivePackages: () => [],
            getLoadedPackages: () => packages
          })
        let {element} = component

        expect(element.querySelectorAll('.incompatible-package').length).toEqual(0)

        await etchScheduler.getNextUpdatePromise()

        expect(element.querySelectorAll('.incompatible-package').length).toBeGreaterThan(0)
      })
    })
  })

  describe('when there are no incompatible packages', () => {
    it('does not render incompatible packages or the rebuild button', () => {
      waitsForPromise(async () => {
        expect(packages[2].isCompatible()).toBe(true)
        let compatiblePackages = [packages[2]]

        let component =
          new IncompatiblePackagesComponent({
            getActivePackages: () => compatiblePackages,
            getLoadedPackages: () => compatiblePackages
          })
        let {element} = component

        await etchScheduler.getNextUpdatePromise()

        expect(element.querySelectorAll('.incompatible-package').length).toBe(0)
        expect(element.querySelector('button')).toBeNull()
      })
    })
  })

  describe('when some packages previously failed to rebuild', () => {
    it('renders them with failed build status and error output', () => {
      waitsForPromise(async () => {
        packages[1].getBuildFailureOutput = function () {
          return 'The build failed'
        }

        let component =
          new IncompatiblePackagesComponent({
            getActivePackages: () => packages,
            getLoadedPackages: () => packages
          })
        let {element} = component

        await etchScheduler.getNextUpdatePromise()
        expect(element.querySelector('.incompatible-package:nth-child(2) .badge').textContent).toBe('Rebuild Failed')
        expect(element.querySelector('.incompatible-package:nth-child(2) pre').textContent).toBe('The build failed')
      })
    })
  })

  describe('when there are incompatible packages', () => {
    it('renders incompatible packages and the rebuild button', () => {
      waitsForPromise(async () => {
        let component =
          new IncompatiblePackagesComponent({
            getActivePackages: () => packages,
            getLoadedPackages: () => packages
          })
        let {element} = component

        await etchScheduler.getNextUpdatePromise()

        expect(element.querySelectorAll('.incompatible-package').length).toEqual(2)
        expect(element.querySelector('button')).not.toBeNull()
      })
    })

    describe('when the rebuild button is clicked', () => {
      it('rebuilds every incompatible package, updating each package\'s view with status', () => {
        waitsForPromise(async () => {
          let component =
            new IncompatiblePackagesComponent({
              getActivePackages: () => packages,
              getLoadedPackages: () => packages
            })
          let {element} = component
          jasmine.attachToDOM(element)

          await etchScheduler.getNextUpdatePromise()

          component.refs.rebuildButton.dispatchEvent(new CustomEvent('click', {bubbles: true}))
          await etchScheduler.getNextUpdatePromise() // view update

          expect(packages[0].resolveRebuild).toBeDefined()

          expect(element.querySelector('.incompatible-package:nth-child(1) .badge').textContent).toBe('Rebuilding')
          expect(element.querySelector('.incompatible-package:nth-child(2) .badge')).toBeNull()

          packages[0].resolveRebuild({code: 0}) // simulate rebuild success
          await etchScheduler.getNextUpdatePromise() // view update

          expect(packages[1].resolveRebuild).toBeDefined()

          expect(element.querySelector('.incompatible-package:nth-child(1) .badge').textContent).toBe('Rebuild Succeeded')
          expect(element.querySelector('.incompatible-package:nth-child(2) .badge').textContent).toBe('Rebuilding')

          packages[1].resolveRebuild({code: 12, stderr: 'This is an error from the test!'}) // simulate rebuild failure
          await etchScheduler.getNextUpdatePromise() // view update

          expect(element.querySelector('.incompatible-package:nth-child(1) .badge').textContent).toBe('Rebuild Succeeded')
          expect(element.querySelector('.incompatible-package:nth-child(2) .badge').textContent).toBe('Rebuild Failed')
          expect(element.querySelector('.incompatible-package:nth-child(2) pre').textContent).toBe('This is an error from the test!')
        })
      })
    })
  })
})
