<?php

declare(strict_types=1);

namespace ItechWorld\SuluGrapesJsBundle\Controller\Admin;

use Sulu\Component\DocumentManager\DocumentManager;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Sulu\Component\Content\Document\Behavior\WorkflowStageBehavior;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Translation\TranslatorBagInterface;

class PageBuilderController extends AbstractController
{
    #[Route('/admin/page-builder/{webspace}/{locale}/{id}', name: 'admin_page_builder')]
    public function index(
        string $webspace,
        string $locale,
        string $id,
        DocumentManager $documentManager,
        TranslatorBagInterface $translator
    ): Response {
        $page = $documentManager->find($id, $locale);

        $jsonBuilderHtml = null;
        $jsonBuilderCss = null;
        if ($page && $structure = $page->getStructure()) {
            if (!$structure->hasProperty('json_builder_html') || !$structure->hasProperty('json_builder_css')) {
                return $this->redirectToRoute('sulu_page.get_page', [
                    'webspace' => $webspace,
                    'locale' => $locale,
                    'id' => $id,
                ]);
            }

            $propertyHtml = $structure->getProperty('json_builder_html');
            $propertyCss = $structure->getProperty('json_builder_css');

            if ($propertyHtml) {
                $jsonBuilderHtml = $propertyHtml->getValue();
            }
            if ($propertyCss) {
                $jsonBuilderCss = $propertyCss->getValue();
            }
        }

        $publishState = $page instanceof WorkflowStageBehavior
        ? $page->getWorkflowStage()
        : null;

        $changed = $page->getChanged();
        $lastModified = $page->getLastModified();

        $flat = $translator->getCatalogue($locale)->all('grapesjs');

        $nested = self::unflattenArray($flat);

        $cssPath = $this->getParameter('itech_world_sulu_grapesjs.frontend_css_path');
        $jsPath = $this->getParameter('itech_world_sulu_grapesjs.frontend_js_path');

        dump($publishState);

        return $this->render('@ItechWorldSuluGrapesJs/admin/index.html.twig', [
            'webspace' => $webspace,
            'locale' => $locale,
            'id' => $id,
            'page' => $page,
            'json_builder_html' => $jsonBuilderHtml,
            'json_builder_css' => $jsonBuilderCss,
            'publish_state' => $publishState == 2 ? true : false,
            'translations' => json_encode($nested),
            'frontend_css_path' => $cssPath,
            'frontend_js_path' => $jsPath,
        ]);
    }

    #[Route('/admin/page-builder/{webspace}/{locale}/{id}/save', name: 'admin_page_builder_save', methods: ['POST'])]
    public function save(
        string $webspace,
        string $locale,
        string $id,
        Request $request,
        DocumentManager $documentManager
    ): JsonResponse {
        $data = json_decode($request->getContent(), true);

        if (!$data || !isset($data['html']) || !isset($data['css'])) {
            return new JsonResponse(['error' => 'Données invalides'], 400);
        }

        $page = $documentManager->find(
            $id,
            $locale,
            [
                'load_ghost_content' => false,
                'load_shadow_content' => false,
            ]
        );
        if (!$page || !$page->getStructure()) {
            return new JsonResponse(['error' => 'Page introuvable'], 404);
        }

        $page->getStructure()->getProperty('json_builder_html')->setValue($data['html']);
        $page->getStructure()->getProperty('json_builder_css')->setValue($data['css']);
        $documentManager->persist($page, $locale);
        $documentManager->flush();

        return new JsonResponse(['success' => true]);
    }

    #[Route('/admin/page-builder/{webspace}/{locale}/{id}/publish', name: 'admin_page_builder_publish', methods: ['GET'])]
    public function publish(
        string $webspace,
        string $locale,
        string $id,
        DocumentManager $documentManager
    ): JsonResponse {
        $page = $documentManager->find(
            $id,
            $locale,
            [
                'load_ghost_content' => true,
                'load_shadow_content' => true,
            ]
        );
        if (!$page || !$page->getStructure()) {
            return new JsonResponse(['error' => 'Page introuvable'], 404);
        }

        $page->setLastModified(new \DateTime());
        $documentManager->persist($page, $locale);
        $documentManager->publish($page, $locale);
        $documentManager->flush();

        return new JsonResponse(['success' => true]);
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
