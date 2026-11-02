import { lazy, Suspense, type ComponentType, type LazyExoticComponent } from "react";
import { Navigate, type RouteObject } from "react-router-dom";
import { appModules } from "@/core/modules/registry";
import type { ModuleRoute, PageLoader } from "@/core/modules/types";
import AppLayout from "../pages/app/layout";
import AppLoadingScreen from "../pages/app/components/AppLoadingScreen";
import ModulePlaceholder from "../pages/app/components/ModulePlaceholder";
import NotFound from "../pages/NotFound";

/**
 * Rotas do sistema.
 *
 * As rotas internas (`/app/...`) NÃO são listadas aqui: cada módulo declara as
 * suas no próprio `module.ts`, e este arquivo só as reúne. Todas as telas são
 * carregadas sob demanda — o navegador baixa o código de um módulo apenas
 * quando alguém o abre.
 */

const lazyCache = new Map<PageLoader, LazyExoticComponent<ComponentType>>();

/** Tela carregada sob demanda, com a tela de "Carregando…" enquanto baixa. */
function LazyPage({ load, variant = "panel" }: { load: PageLoader; variant?: "panel" | "full" }) {
  let Component = lazyCache.get(load);
  if (!Component) {
    Component = lazy(load);
    lazyCache.set(load, Component);
  }
  return (
    <Suspense fallback={<AppLoadingScreen variant={variant} />}>
      <Component />
    </Suspense>
  );
}

/** Elemento de uma rota de módulo: tela, redirecionamento ou página "em breve". */
function ModuleRouteElement({ route }: { route: ModuleRoute }) {
  if (route.redirectTo) return <Navigate to={route.redirectTo} replace />;
  if (route.load) return <LazyPage load={route.load} />;
  return <ModulePlaceholder />;
}

const appChildren: RouteObject[] = appModules.flatMap((module) =>
  module.routes.map<RouteObject>((route) =>
    route.path === ""
      ? { index: true, element: <ModuleRouteElement route={route} /> }
      : { path: route.path, element: <ModuleRouteElement route={route} /> }
  )
);

const routes: RouteObject[] = [
  { path: "/", element: <LazyPage variant="full" load={() => import("../pages/home/page")} /> },
  { path: "/login", element: <LazyPage variant="full" load={() => import("../pages/login/page")} /> },
  { path: "/redefinir-senha", element: <LazyPage variant="full" load={() => import("../pages/redefinir-senha/page")} /> },
  { path: "/primeiro-acesso", element: <LazyPage variant="full" load={() => import("../pages/primeiro-acesso/page")} /> },
  { path: "/fiscalizacao/:id", element: <LazyPage variant="full" load={() => import("../pages/fiscalizacao/page")} /> },
  { path: "/validar/:token", element: <LazyPage variant="full" load={() => import("../pages/validar/page")} /> },
  { path: "/votacao/:token", element: <LazyPage variant="full" load={() => import("../pages/votacao/page")} /> },
  {
    path: "/app",
    element: <AppLayout />,
    children: [
      ...appChildren,
      // Item de menu ainda sem tela própria → página "em breve".
      { path: ":module", element: <ModulePlaceholder /> },
    ],
  },
  { path: "*", element: <NotFound /> },
];

export default routes;
