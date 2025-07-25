<?php

declare(strict_types=1);

namespace ItechWorld\SuluGrapesJsBundle\Controller\Admin;

use Sulu\Bundle\PreviewBundle\Preview\Preview;
use Sulu\Bundle\WebsiteBundle\Controller\WebsiteController as WebsiteControllerBase;
use Sulu\Component\Content\Document\Behavior\WorkflowStageBehavior;
use Sulu\Component\DocumentManager\DocumentManager;
use Symfony\Component\Translation\TranslatorBagInterface;

class WebsitePreviewController extends WebsiteControllerBase
{

    public function __construct(
        private DocumentManager $documentManager,
        private TranslatorBagInterface $translator,
    ) {}

    protected function renderPreview(string $view, array $parameters = []): string
    {
        $parameters['previewParentTemplate'] = $view;
        $parameters['previewContentReplacer'] = Preview::CONTENT_REPLACER;

        $page = $this->documentManager->find($parameters['id'], $parameters['request']['defaultLocale']);

        $publishState = $page instanceof WorkflowStageBehavior
        ? $page->getWorkflowStage()
        : null;
        
        $parameters['publish_state'] = $publishState;

        $flat = $this->translator->getCatalogue($parameters['request']['defaultLocale'])->all('grapesjs');

        $nested = self::unflattenArray($flat);
        
        $parameters['translations'] = json_encode($nested);

        $cssPath = $this->getParameter('itech_world_sulu_grapesjs.frontend_css_path');
        $parameters['frontend_css_path'] = $cssPath;

        $jsPath = $this->getParameter('itech_world_sulu_grapesjs.frontend_js_path');
        $parameters['frontend_js_path'] = $jsPath;

        return $this->renderView('@SuluWebsite/Preview/preview.html.twig', $parameters);
    }

    private static function unflattenArray(array $flat): array
    {
        $flatWithoutPrefix = [];
        foreach ($flat as $key => $value) {
            if (str_starts_with($key, 'grapesjs.')) {
                $flatKey = substr($key, strlen('grapesjs.'));
                $flatWithoutPrefix[$flatKey] = $value;
            }
        }
        
        $nested = [];

        foreach ($flatWithoutPrefix as $flatKey => $value) {
            $keys = explode('.', $flatKey);
            $ref = &$nested;

            foreach ($keys as $key) {
                if (!isset($ref[$key]) || !is_array($ref[$key])) {
                    $ref[$key] ??= [];
                }
                $ref = &$ref[$key];
            }

            $ref = $value;
        }

        return $nested;
    }
}
