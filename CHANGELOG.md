# [](https://github.com/steeven-th/SuluGrapesJsBundle/compare/v1.0.1...v) (2026-02-12)


### Features

* add image format selector, asset manager pagination and search ([c6fb4aa](https://github.com/steeven-th/SuluGrapesJsBundle/commit/c6fb4aaf9faacb9a870cc442a64222ca82a142e0))



# [](https://github.com/steeven-th/SuluGrapesJsBundle/compare/v1.0.0...v) (2026-02-12)


### Features

* preview mode sync, standalone builder option, CSS auto-detection ([64b087d](https://github.com/steeven-th/SuluGrapesJsBundle/commit/64b087df98415db6ae73238e9fe5b28cfbbd90fe))



# [](https://github.com/steeven-th/SuluGrapesJsBundle/compare/v1.0.0...v) (2026-02-12)


### Features

* preview mode sync, standalone builder option, CSS auto-detection ([64b087d](https://github.com/steeven-th/SuluGrapesJsBundle/commit/64b087df98415db6ae73238e9fe5b28cfbbd90fe))



#  (2026-02-12)


* feat!: migrate bundle to Sulu 3.0 compatibility ([69a2cab](https://github.com/steeven-th/SuluGrapesJsBundle/commit/69a2cab43827a72ecf944e7fa0d71dd3b74ccc4d))


### BREAKING CHANGES

* This version drops Sulu 2.x support entirely.

- Replace sulu_core.content.structure.paths with sulu_admin.templates.page.directories
- Replace DocumentManager APIs with PageRepositoryInterface + ContentManagerInterface
- Replace WebsiteController/StructureInterface with ContentController::indexAction
- Replace WorkflowStageBehavior (int) with WorkflowInterface::getWorkflowPlace() (string)
- Replace resource_locator type with route in builder.xml template
- Update admin view constant from .details to .content
- Remove obsolete PageBuilderController (Website) and WebsitePreviewController
- Rewrite admin PageBuilderController with Sulu 3.0 APIs (resolve/persist/applyTransition)
- Clean up services.yaml: remove DocumentManager and WebsiteController aliases
- Update composer.json requirement to sulu/sulu ^3.0
- Translate all comments to English
- Consolidate release workflow



## [0.1.8](https://github.com/steeven-th/SuluGrapesJsBundle/compare/0.1.7...0.1.8) (2025-07-03)


### Bug Fixes

* replace isModified by native publishState of Sulu ([16daac8](https://github.com/steeven-th/SuluGrapesJsBundle/commit/16daac81ee37a3f390126a0f4f4ceea392b8372f))



## [0.1.7](https://github.com/steeven-th/SuluGrapesJsBundle/compare/0.1.6-b...0.1.7) (2025-07-02)


### Bug Fixes

* add manuel workflow for release ([0b174cd](https://github.com/steeven-th/SuluGrapesJsBundle/commit/0b174cd4b3b54af3ff6cd749f6f7fca144dcf4a7))



## [0.1.6-b](https://github.com/steeven-th/SuluGrapesJsBundle/compare/0.1.6...0.1.6-b) (2025-07-02)


### Bug Fixes

* add new grapesjs build ([bd9e09a](https://github.com/steeven-th/SuluGrapesJsBundle/commit/bd9e09a10efe321d3305588c8194e196f5edeabf))
* update workflow ([d0c29b6](https://github.com/steeven-th/SuluGrapesJsBundle/commit/d0c29b66bb547f13c9ac203c127088895f44b2ed))



## [0.1.6](https://github.com/steeven-th/SuluGrapesJsBundle/compare/0.1.5...0.1.6) (2025-07-02)


### Bug Fixes

* increase media fetch limit to 300 in asset provider ([2162ca6](https://github.com/steeven-th/SuluGrapesJsBundle/commit/2162ca6d25feb5f9d06b6b1502fa20f1848d566f))



## [0.1.5](https://github.com/steeven-th/SuluGrapesJsBundle/compare/0.1.4...0.1.5) (2025-07-02)


### Bug Fixes

* use nullsafe operator to avoid errors when comparing nullable DateTime values ([a8bf95c](https://github.com/steeven-th/SuluGrapesJsBundle/commit/a8bf95c65fe6670dcad76745c81d88914a7a2bad))



## [0.1.4](https://github.com/steeven-th/SuluGrapesJsBundle/compare/0.1.3...0.1.4) (2025-07-02)


### Bug Fixes

* change page template path to avoid conflict with another bundle ([b287e14](https://github.com/steeven-th/SuluGrapesJsBundle/commit/b287e14521bccf0b21b9a0cec5c1cb310bba3e06))



## [0.1.3](https://github.com/steeven-th/SuluGrapesJsBundle/compare/0.1.2...0.1.3) (2025-07-02)


### Bug Fixes

* color code in labels.yaml ([d75fe93](https://github.com/steeven-th/SuluGrapesJsBundle/commit/d75fe938532e5d914392490bd665de90a4af2d55))
* correct toolbar action configuration ([99c37d2](https://github.com/steeven-th/SuluGrapesJsBundle/commit/99c37d298d8224e416d6d393debfa27aad1e17e3))



## 0.1.2 (2025-07-02)


### Bug Fixes

* add CHANGELOG ([006c8a0](https://github.com/steeven-th/SuluGrapesJsBundle/commit/006c8a0b482d4e0f2a18dba5b588f34ceb29e7e1))
* add npm install dependencies in workflow ([a22a16e](https://github.com/steeven-th/SuluGrapesJsBundle/commit/a22a16e8faf5c947e7080ceb724fd5c478836426))
* update workflow ([ec25ab8](https://github.com/steeven-th/SuluGrapesJsBundle/commit/ec25ab843e70f6321e1fb78b9995b5b175e3e627))



# 0.1.0 (2025-07-02)



