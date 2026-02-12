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
function t(key, params = {}) {
    const value = key.split('.').reduce((obj, k) => (obj || {})[k], translations) || '';
    if (typeof params === 'object' && params !== null) {
        return value.replace(/\{\{(\w+)\}\}/g, (_, k) => params[k] ?? '');
    }
    return value;
}

const saveButton = document.getElementById('save');
const publishButton = document.getElementById('publish');

// --- Synchronization with the Sulu admin FormStore (preview mode) ---
let lastSentHtml = null;
let lastSentCss = null;

function getPreviewTarget() {
    return window.parent !== window ? window.parent : window.opener;
}

// Full sync: sends data AND triggers a preview re-render.
// Forces commit of inline edits before reading HTML.
function notifyParentOfChanges(editorInstance) {
    // Force GrapeJS to commit inline edits ONLY when the RTE is active
    // (prevents corrupting structural components via sync:content)
    const rte = editorInstance.RichTextEditor;
    if (rte && typeof rte.getToolbarEl === 'function' && rte.getToolbarEl()?.style?.display !== 'none') {
        const selected = editorInstance.getSelected();
        if (selected) {
            selected.trigger('sync:content');
        }
    }

    // Cancel pending timer to avoid a crossed message after re-render
    clearTimeout(_pendingTimer);

    const currentHtml = editorInstance.getHtml();
    const currentCss = editorInstance.getCss();

    lastSentHtml = currentHtml;
    lastSentCss = currentCss;

    const target = getPreviewTarget();
    if (target) {
        target.postMessage({
            type: 'sulu-grapes-update',
            html: currentHtml,
            css: currentCss,
        }, window.location.origin);
    }
}

// Silent sync: sends data to the parent without triggering a re-render.
// The parent stores the data and marks the FormStore dirty ("unsaved changes" alert).
let _pendingTimer;
function sendPendingToParent(editorInstance) {
    clearTimeout(_pendingTimer);
    _pendingTimer = setTimeout(() => {
        // No sync:content here — sendPendingToParent is silent and must not
        // interfere with inline editing (cursor loss).
        // Precise commit is done in notifyParentOfChanges (explicit Sync).
        const currentHtml = editorInstance.getHtml();
        const currentCss = editorInstance.getCss();
        const target = getPreviewTarget();
        if (target) {
            target.postMessage({
                type: 'sulu-grapes-pending',
                html: currentHtml,
                css: currentCss,
            }, window.location.origin);
        }
    }, 1000);
}


const loadImagesAssetsFromSulu = async (locale, formats) => {
    try {
        const response = await fetch(`/admin/api/media?locale=${locale}&filter[type]=image&limit=300`, {
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
        const response = await fetch(`/admin/api/media?locale=${locale}&filter[type]=document&limit=300`, {
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
    const saveIcon = saveButton?.querySelector('i');
    const publishButton = document.querySelector('#publish');

    if (saveIcon) saveIcon.style.color = 'orange';
    if (saveButton) saveButton.disabled = true;

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

        if (publishButton) publishButton.disabled = false;
        if (saveButton) saveButton.disabled = true;

        if (saveIcon) {
            setTimeout(() => {
                saveIcon.style.color = '';
            }, 1000);
        }

        return { id: 1, data, pagesHtml };
    } catch (err) {
        if (saveButton) saveButton.disabled = false;
        console.error(`❌ ${t('console_error.save_error')}`, err);
        if (saveIcon) saveIcon.style.color = '';
        throw err;
    }
}

async function publish(publishUrl) {
    const publishButton = document.querySelector('#publish');
    const publishIcon = publishButton.querySelector('i');

    // Change color to orange during publishing
    publishIcon.style.color = 'orange';
    publishButton.disabled = true;

    try {
        const response = await fetch(publishUrl, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
        });

        const responseData = await response.json();
        if (!response.ok || !responseData.success) {
            throw new Error(responseData.error || 'Server error');
        }

        publishButton.disabled = true;

        // Reset color to default after 1 second
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
    const frontendJsPath = root.getAttribute('data-frontend-js-path');

    const jsonBuilderHtml = root.getAttribute('data-json-builder-html');
    const jsonBuilderCss = root.getAttribute('data-json-builder-css');
    const locale = root.getAttribute('data-locale');
    const imagesFormats = root.getAttribute('data-images-formats');

    // Preview mode detection (no save button = preview mode)
    const isPreviewMode = !saveButton;
    const previewStorageKey = isPreviewMode && saveUrl
        ? `gjsPreview-${encodeURIComponent(saveUrl)}`
        : null;

    // In preview mode, recover the current editing session data
    // saved in localStorage before the Sulu re-render
    let effectiveHtml = jsonBuilderHtml;
    let effectiveCss = jsonBuilderCss;

    if (previewStorageKey) {
        try {
            const stored = JSON.parse(localStorage.getItem(previewStorageKey));
            if (stored && stored.ts && (Date.now() - stored.ts < 300000)) {
                // Check that base data hasn't changed
                // (e.g. saved via standalone builder in the meantime)
                if (stored.baseHtml === jsonBuilderHtml && stored.baseCss === jsonBuilderCss) {
                    effectiveHtml = stored.html;
                    effectiveCss = stored.css;
                } else {
                    // Backend data changed → stale cache
                    localStorage.removeItem(previewStorageKey);
                }
            }
        } catch (e) { /* ignore */ }
    }

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

    if (effectiveHtml) {
        projectData.pages = [{
            name: 'Page 1',
            component: effectiveHtml,
        }];
    }

    if (effectiveCss && projectData.pages.length) {
        let component = projectData.pages[0].component || '';
        const styleTag = `<style>${effectiveCss}</style>`;
        component = component.includes('<head>')
            ? component.replace('<head>', `<head>${styleTag}`)
            : styleTag + component;
        projectData.pages[0].component = component;
    }

    // Styles and scripts to inject into the GrapeJS canvas (nested iframe).
    // In preview: <link> elements from the document (loaded by Sulu) are cloned
    // into the canvas via the load event (survives internal frame rebuilds).
    // In standalone: uses paths configured in the YAML.
    const builderAssetPatterns = ['grapesjs', 'grape-builder', 'itechworldsulugrapesjs'];
    const isBuilderAsset = (url) => builderAssetPatterns.some(p => url.includes(p));

    let canvasStyles = [];
    let canvasScripts = [];

    if (!isPreviewMode) {
        if (frontendCssPath) canvasStyles.push(frontendCssPath);
        if (frontendJsPath) canvasScripts.push(frontendJsPath);
    }

    const editor = grapesjs.init({
        container: '#sulu-page-builder',
        // Override default GrapeJS baseCss to remove background-color: #fff
        // on the body, so that frontend styles can apply normally
        baseCss: `
            * { box-sizing: border-box; }
            html, body, [data-gjs-type=wrapper] { min-height: 100%; }
            body { margin: 0; height: 100%; }
            [data-gjs-type=wrapper] { overflow: auto; overflow-x: hidden; }
            * ::-webkit-scrollbar-track { background: rgba(0, 0, 0, 0.1); }
            * ::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.2); }
            * ::-webkit-scrollbar { width: 10px; }
        `,
        canvas: {
            styles: canvasStyles,
            scripts: canvasScripts,
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
        // In preview mode (no save button), disable storageManager
        // to avoid auto-saves interfering with the Sulu FormStore flow
        storageManager: saveButton ? {
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
        } : false,
        i18n: {
            messages: {
                de,
                fr,
            }
        }
    });

    // Custom command to open the Asset Manager filtered on documents
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

    // Add DOCUMENT component (link or button to a file)
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

    // Add DOCUMENT-LINK block to the block manager
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

    // In preview: clone <link rel="stylesheet"> from the parent document into the
    // GrapeJS canvas. Executed on each canvas frame (re)load so that styles
    // survive internal GrapeJS rebuilds.
    // Only <link> elements are cloned (not inline <style> which may contain
    // builder or framework styles that would break the canvas).
    if (isPreviewMode) {
        const injectPreviewLinks = () => {
            const canvasDoc = editor.Canvas.getDocument();
            if (!canvasDoc) return;

            document.querySelectorAll('link[rel="stylesheet"]').forEach(link => {
                if (!link.href || isBuilderAsset(link.href)) return;
                // Avoid duplicates
                if (canvasDoc.querySelector(`link[href="${link.href}"]`)) return;
                const clone = canvasDoc.createElement('link');
                clone.rel = 'stylesheet';
                clone.href = link.href;
                canvasDoc.head.appendChild(clone);
            });
        };
        // 'load' = editor fully initialized, canvas ready
        editor.on('load', injectPreviewLinks);
    }

    // Initialize anti-loop reference values
    // In preview: from the actual editor state (may come from localStorage)
    // to avoid an immediate postMessage after re-render
    if (isPreviewMode) {
        lastSentHtml = editor.getHtml();
        lastSentCss = editor.getCss();
    } else {
        lastSentHtml = jsonBuilderHtml;
        lastSentCss = jsonBuilderCss;
    }

    // Handle save button click (button does not exist in preview mode)
    if (saveButton) {
        saveButton.addEventListener('click', () => {
            const data = editor.getProjectData();
            save(editor, data, saveUrl);
            updateSaveIconState(false);
            notifyParentOfChanges(editor);
        });
    }

    if (publishButton) {
        publishButton.addEventListener('click', () => {
            publish(publishUrl);
        });
    }

    const builder = document.getElementById('sulu-page-builder');
    const header = document.querySelector('sulu-navbar');

    function adjust() {
        const offset = header?.offsetHeight ?? 73;
        const height = window.innerHeight * 0.962 - offset;
        builder.style.height = `${height}px`;
    }

    adjust();
    window.addEventListener('resize', adjust);

    // localStorage save in preview mode (to survive re-renders)
    function saveToPreviewStorage() {
        if (!previewStorageKey) return;
        try {
            localStorage.setItem(previewStorageKey, JSON.stringify({
                html: editor.getHtml(),
                css: editor.getCss(),
                baseHtml: jsonBuilderHtml,
                baseCss: jsonBuilderCss,
                ts: Date.now(),
            }));
        } catch (e) { /* quota exceeded or other - ignore */ }
    }

    // Flag to ignore events during editor initialization.
    // GrapeJS fires component:add for each component loaded from HTML,
    // which would trigger a false dirty state if processed.
    let editorReady = false;
    editor.on('load', () => { editorReady = true; });

    // Change detected: update save icon, localStorage and preview sync
    const onEditorChange = () => {
        if (!editorReady) return;
        updateSaveIconState(true);
        saveToPreviewStorage();
        if (isPreviewMode) sendPendingToParent(editor);
    };

    // component:update = property change on an existing component
    editor.on('component:update', () => {
        if (!editorReady) return;
        if (editor.getHtml() !== jsonBuilderHtml || editor.getCss() !== jsonBuilderCss) {
            updateSaveIconState(true);
        }
        saveToPreviewStorage();
        if (isPreviewMode) sendPendingToParent(editor);
    });

    // component:add / component:remove = block added or removed
    editor.on('component:add', onEditorChange);
    editor.on('component:remove', onEditorChange);

    editor.on('style:update', onEditorChange);
    editor.on('asset:update', onEditorChange);

    // In preview mode: sync with the Sulu FormStore only when the user
    // leaves the editor (blur) or presses Ctrl+S / Cmd+S.
    // This prevents unwanted preview re-renders during editing.
    if (isPreviewMode) {
        // Ctrl+S / Cmd+S: immediate sync with the Sulu FormStore
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                notifyParentOfChanges(editor);
            }
        });

        // Sync button in the preview banner
        const syncButton = document.getElementById('preview-sync');
        if (syncButton) {
            syncButton.addEventListener('click', () => {
                notifyParentOfChanges(editor);
            });
        }
    }
});