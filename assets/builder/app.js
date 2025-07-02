import grapesjs from 'grapesjs';
import plugin from 'grapesjs-preset-webpage';
import blocksBasic from 'grapesjs-blocks-basic'; //https://github.com/GrapesJS/blocks-basic
import bg from 'grapesjs-style-bg'; //https://github.com/GrapesJS/tui-image-editor
import 'grapick/dist/grapick.min.css';
import customCode from 'grapesjs-custom-code'; //https://github.com/GrapesJS/components-custom-code
import tooltip from 'grapesjs-tooltip'; //https://github.com/GrapesJS/components-tooltip
import typed from 'grapesjs-typed'; //https://github.com/GrapesJS/components-typed
import filter from 'grapesjs-style-filter'; //https://github.com/GrapesJS/style-filter
import countdown from 'grapesjs-component-countdown'; //https://github.com/GrapesJS/components-countdown
import tuiImageEditor from 'grapesjs-tui-image-editor'; //https://github.com/GrapesJS/tui-image-editor
import grapesjsObjectFit from 'grapesjs-object-fit'; //https://github.com/steeven-th/grapesjs-object-fit
import rteExtension from 'grapesjs-rte-toolbar-extensions'; //https://github.com/steeven-th/grapesjs-rte-toolbar-extensions
import de from 'grapesjs/locale/de';
import fr from 'grapesjs/locale/fr';

const root = document.getElementById('sulu-page-builder');
const translations = JSON.parse(root.getAttribute('data-translations') || '{}');
function t(key, defaultValue = '') {
    return key.split('.').reduce((obj, k) => (obj || {})[k], translations) || defaultValue;
}

const saveButton = document.getElementById('save');
const publishButton = document.getElementById('publish');

const loadImagesAssetsFromSulu = async (locale, formats) => {
    try {
        const response = await fetch(`/admin/api/media?locale=${locale}&filter[type]=image`, {
            headers: {
                'Accept': 'application/json',
            },
            credentials: 'include',
        });

        const data = await response.json();

        const assets = data._embedded.media.flatMap((media) => {
            const thumbnails = media.thumbnails || {};

            return Object.entries(formats).map(([formatLabel, suluKey]) => {
                const src = thumbnails[suluKey] || null;

                if (!src) {
                    console.warn(t('console_warn.format_not_available', { format: suluKey, mediaId: media.id }));
                    return null;
                }

                return {
                    type: 'image',
                    name: `${formatLabel} - ${media.title || media.name}`,
                    src,
                };
            }).filter(Boolean);
        });

        return assets;
    } catch (err) {
        console.error(t('console_error.load_images_assets_from_sulu'), err);
        return [];
    }
};

const loadDocumentsAssetsFromSulu = async (locale) => {
    try {
        const response = await fetch(`/admin/api/media?locale=${locale}&filter[type]=document`, {
            headers: {
                'Accept': 'application/json',
            },
            credentials: 'include',
        });

        const data = await response.json();

        const assets = data._embedded.media.map((media) => {
            return {
                type: 'document',
                name: media.title || media.name,
                src: media.url,
            };
        });

        return assets;
    } catch (err) {
        console.error(t('console_error.load_documents_assets_from_sulu'), err);
        return [];
    }
};

function updateSaveIconState(isModified) {
    const saveIcon = document.querySelector('#save i');
    if (saveIcon) {
        saveIcon.style.color = isModified ? 'orange' : '';
        saveButton.disabled = !isModified;
    }
}

async function save(editor, data, saveUrl) {
    if (!saveUrl || !editor) return { id: 1, data, pagesHtml: [] };

    const saveButton = document.querySelector('#save');
    const saveIcon = saveButton.querySelector('i');
    const publishButton = document.querySelector('#publish');

    saveIcon.style.color = 'orange';
    saveButton.disabled = true;

    const pages = editor.Pages.getAll();
    const pagesHtml = [];

    try {
        for (const page of pages) {
            const component = page.getMainComponent();
            const html = editor.getHtml({ component });
            const css = editor.getCss({ component });

            const response = await fetch(saveUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ html, css }),
            });

            const responseData = await response.json();
            if (!response.ok || !responseData.success) {
                throw new Error(responseData.error || t('errors.server_error'));
            }

            console.log(`✅ ${t('messages.save_success')}`);

            pagesHtml.push({
                html,
                css,
            });
        }

        publishButton.disabled = false;
        saveButton.disabled = true;

        setTimeout(() => {
            saveIcon.style.color = '';
        }, 1000);

        return { id: 1, data, pagesHtml };
    } catch (err) {
        saveButton.disabled = false;
        console.error(`❌ ${t('console_error.save_error')}`, err);
        saveIcon.style.color = '';
        throw err;
    }
}

async function publish(publishUrl) {
    const publishButton = document.querySelector('#publish');
    const publishIcon = publishButton.querySelector('i');

    // Changer la couleur en orange pendant la publication
    publishIcon.style.color = 'orange';
    publishButton.disabled = true;

    try {
        const response = await fetch(publishUrl, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
        });

        const responseData = await response.json();
        if (!response.ok || !responseData.success) {
            throw new Error(responseData.error || 'Erreur serveur');
        }

        publishButton.disabled = true;

        // Remettre la couleur par défaut après 2 secondes
        setTimeout(() => {
            publishIcon.style.color = '';
        }, 1000);

        console.log(`✅ ${t('messages.publish_success')}`);
    } catch (err) {
        console.error(`❌ ${t('messages.publish_error')}`, err);
        throw err;
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    const containerId = 'sulu-page-builder';
    const root = document.getElementById(containerId);

    if (!root) {
        console.error(t('grapesjs.console_error.container_not_found', { containerId: containerId }));
        return;
    }

    const saveUrl = root.getAttribute('data-save-url');
    if (!saveUrl) {
        console.warn(t('grapesjs.console_warn.save_url_missing', { containerId: containerId }));
    }

    const publishUrl = root.getAttribute('data-publish-url');
    if (!publishUrl) {
        console.warn(t('grapesjs.console_warn.publish_url_missing', { containerId: containerId }));
    }

    const frontendCssPath = root.getAttribute('data-frontend-css-path');

    const jsonBuilderHtml = root.getAttribute('data-json-builder-html');
    const jsonBuilderCss = root.getAttribute('data-json-builder-css');
    const locale = root.getAttribute('data-locale');
    const youtubeApiKey = root.getAttribute('data-youtube-api-key');
    const imagesFormats = root.getAttribute('data-images-formats');

    const imagesAssets = await loadImagesAssetsFromSulu(locale, JSON.parse(imagesFormats));
    const documentsAssets = await loadDocumentsAssetsFromSulu(locale);

    let projectData = {
        pages: [{
            name: 'Page 1',
            component: '',
        }],
        assets: [...imagesAssets, ...documentsAssets],
        styles: [],
    };

    if (jsonBuilderHtml) {
        projectData.pages = [{
            name: 'Page 1',
            component: jsonBuilderHtml,
        }];
    }

    if (jsonBuilderCss && projectData.pages.length) {
        let component = projectData.pages[0].component || '';
        const styleTag = `<style>${jsonBuilderCss}</style>`;
        component = component.includes('<head>')
            ? component.replace('<head>', `<head>${styleTag}`)
            : styleTag + component;
        projectData.pages[0].component = component;
    }

    const editor = grapesjs.init({
        container: '#sulu-page-builder',
        canvas: {
            styles: [
                frontendCssPath,
            ],
        },
        plugins: [
            editor => plugin(editor, {}),
            editor => blocksBasic(editor, {
                flexGrid: true,
            }),
            editor => bg(editor, {}),
            editor => customCode(editor, {}),
            editor => tooltip(editor, {}),
            editor => typed(editor, {}),
            editor => filter(editor, {}),
            editor => countdown(editor, {}),
            editor => tuiImageEditor(editor, {}),
            editor => grapesjsObjectFit(editor, {}),
            editor => rteExtension(editor, {}),
        ],
        assetManager: {
            upload: false,
            autoAdd: false,
            embedAsBase64: false,
            showUrlInput: false,
            assets: [...imagesAssets, ...documentsAssets],
        },
        projectData: projectData,
        storageManager: {
            type: 'local',
            options: {
                local: {
                    key: `gjsProject-1`,
                    onStore: async (data, editor) => {
                        console.log(data);
                        return save(editor, data, saveUrl);
                    },
                }
            }
        },
        i18n: {
            messages: {
                de,
                fr,
            }
        }
    });

    // Commande custom pour ouvrir l'Asset Manager filtré sur les documents
    editor.Commands.add('open-document-asset', {
        run(editor, sender, opts = {}) {
            editor.runCommand('open-assets', {
                types: ['document'],
                onSelect(asset) {
                    const selected = editor.getSelected();
                    if (selected && asset && asset.get('type') === 'document') {
                        selected.addAttributes({ href: asset.get('src') });
                        if (!selected.get('text') || selected.get('text') === t('document.download')) {
                            selected.components(asset.get('name'));
                            selected.set('text', asset.get('name'));
                            selected.set('href', asset.get('src'));
                        }
                    }
                },
            });
            const modal = editor.Modal;
            modal.setTitle(t('document.select_modal_title'));

        },
    });

    // Ajout du composant DOCUMENT (lien ou bouton vers un fichier)
    editor.DomComponents.addType('document-link', {
        isComponent(el) {
            if (el.tagName === 'A' && el.classList.contains('gjs-document-link')) {
                return { type: 'document-link' };
            }
            return false;
        },
        model: {
            defaults: {
                tagName: 'a',
                draggable: true,
                droppable: false,
                attributes: { href: '#', target: '_blank', class: 'gjs-document-link' },
                traits: [
                    {
                        type: 'text',
                        label: t('traits.text'),
                        name: 'text',
                        changeProp: 1,
                    },
                    {
                        type: 'text',
                        label: t('traits.link'),
                        name: 'href',
                        placeholder: t('document.url'),
                        changeProp: 1,
                    },
                    {
                        type: 'button',
                        label: t('blocks.document'),
                        text: t('buttons.choose_document'),
                        full: true,
                        command: 'open-document-asset',
                    },
                ],
                text: '',
                tagName: 'a',
                attributes: {
                    class: 'gjs-document-link',
                    target: '_blank',
                    href: '#'
                }
            },
            init() {
                const href = this.getAttributes().href;

                if (!href || href === '#') {
                    const domHref = this.view?.el?.getAttribute('href');
                    if (domHref) {
                        this.addAttributes({ href: domHref });
                    }
                }

                this.on('change:text', this.handleTextChange);
            },
            handleTextChange() {
                this.components(this.get('text'));
            },
            toHTML() {
                const attrs = this.getAttributes();
                const attrStr = Object.entries(attrs)
                    .map(([key, value]) => ` ${key}="${value}"`)
                    .join('');
                const text = this.get('text');
                return `<a${attrStr}>${text}</a>`;
            },
        },
        view: {
            onRender() {
                const model = this.model;
                const htmlText = this.el.innerHTML.trim();
                const currentText = model.get('text');
                const href = this.el.getAttribute('href');
                const currentHref = model.get('href');

                if (htmlText && htmlText !== currentText) {
                    model.set('text', htmlText);
                } else {
                    this.el.innerHTML = currentText;
                }

                if (href && href !== currentHref) {
                    model.set('href', href);
                } else {
                    this.el.setAttribute('href', currentHref);
                }
            },
        },
    });

    // Ajout du block DOCUMENT-LINK dans le block manager
    editor.BlockManager.add('document-link', {
        label: t('blocks.document'),
        category: 'Basic',
        media: `
          <svg viewBox="0 0 24 24">
            <path fill="currentColor" d="M6 2C4.9 2 4 2.9 4 4V20C4 21.1 4.9 22 6 22H18C19.1 22 20 21.1 20 20V8L14 2H6M13 3.5L18.5 9H14C13.45 9 13 8.55 13 8V3.5M6 4H12V8C12 9.1 12.9 10 14 10H18V20H6V4Z" />
          </svg>
        `,
        content: {
            type: 'document-link',
            content: t('document.download'),
            attributes: {
                href: '#',
            },
        },
    });

    // Gestion du clic sur le bouton de sauvegarde
    saveButton.addEventListener('click', () => {
        const data = editor.getProjectData();
        save(editor, data, saveUrl);
        updateSaveIconState(false);
    });

    publishButton.addEventListener('click', () => {
        publish(publishUrl);
    });

    const builder = document.getElementById('sulu-page-builder');
    const header = document.querySelector('sulu-navbar');

    function adjust() {
        const offset = header?.offsetHeight ?? 73;
        const height = window.innerHeight * 0.962 - offset;
        builder.style.height = `${height}px`;
    }

    adjust();
    window.addEventListener('resize', adjust);

    editor.on('component:update', () => updateSaveIconState(true));
    editor.on('style:update', () => updateSaveIconState(true));
    editor.on('asset:update', () => updateSaveIconState(true));
});