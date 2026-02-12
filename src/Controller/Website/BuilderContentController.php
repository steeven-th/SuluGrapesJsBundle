<?php

declare(strict_types=1);

namespace ItechWorld\SuluGrapesJsBundle\Controller\Website;

use Sulu\Content\Domain\Model\DimensionContentInterface;
use Sulu\Content\Domain\Model\TemplateInterface;
use Sulu\Content\Domain\Model\WorkflowInterface;
use Sulu\Content\UserInterface\Controller\Website\ContentController;
use Symfony\Component\Translation\TranslatorBagInterface;

/**
 * Website controller for pages using the "builder" template.
 *
 * Extends the Sulu 3.0 ContentController to inject the variables
 * required by the GrapeJS editor into the rendering context
 * (preview and frontend).
 *
 * Injected variables:
 * - publish_state : publication state of the page
 * - translations : GrapeJS translations as nested JSON
 * - frontend_css_path / frontend_js_path : frontend asset paths
 * - images_formats : configured image formats
 * - template : template key
 * - webspace : webspace key
 * - locale : page locale
 * - id : page UUID
 */
class BuilderContentController extends ContentController
{
    /**
     * {@inheritdoc}
     */
    public static function getSubscribedServices(): array
    {
        return array_merge(parent::getSubscribedServices(), [
            TranslatorBagInterface::class => TranslatorBagInterface::class,
        ]);
    }

    /**
     * Resolves Sulu parameters and adds GrapeJS builder variables.
     *
     * @param DimensionContentInterface $object      The dimensioned content object
     * @param string                    $webspaceKey Webspace key
     * @param bool                      $normalize   Normalize data (JSON format)
     *
     * @return array<string, mixed> Template parameters
     */
    protected function resolveSuluParameters(
        DimensionContentInterface $object,
        string $webspaceKey,
        bool $normalize,
    ): array {
        $parameters = parent::resolveSuluParameters($object, $webspaceKey, $normalize);

        $locale = $object->getLocale();

        // Publication state via the Sulu 3.0 WorkflowInterface API
        $isPublished = false;
        if ($object instanceof WorkflowInterface) {
            $isPublished = $object->getWorkflowPlace() === WorkflowInterface::WORKFLOW_PLACE_PUBLISHED;
        }

        // GrapeJS translations: fetch catalogue and convert to nested JSON
        $translator = $this->container->get(TranslatorBagInterface::class);
        $flat = $translator->getCatalogue($locale)->all('grapesjs');
        $nested = self::unflattenArray($flat);

        // Template key for detection in the preview template
        $templateKey = null;
        if ($object instanceof TemplateInterface) {
            $templateKey = $object->getTemplateKey();
        }

        // GrapeJS builder specific variables
        $parameters['publish_state'] = $isPublished;
        $parameters['translations'] = json_encode($nested);
        $parameters['frontend_css_path'] = $this->getParameter('itech_world_sulu_grapesjs.frontend_css_path');
        $parameters['frontend_js_path'] = $this->getParameter('itech_world_sulu_grapesjs.frontend_js_path');
        $parameters['images_formats'] = $this->getParameter('itech_world_sulu_grapesjs.images_formats');
        $parameters['template'] = $templateKey;
        $parameters['webspace'] = $webspaceKey;
        $parameters['locale'] = $locale;
        $parameters['id'] = $object->getResource()->getId();

        return $parameters;
    }

    /**
     * Converts a flat dot-keyed array into a nested array.
     *
     * Example: ['grapesjs.a.b.c' => 'val'] → ['a' => ['b' => ['c' => 'val']]]
     *
     * The 'grapesjs.' prefix is stripped from keys before conversion.
     *
     * @param array<string, string> $flat Flat translation array
     *
     * @return array<string, mixed> Nested array
     */
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
