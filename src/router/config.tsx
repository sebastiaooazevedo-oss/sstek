import { lazy, Suspense, type ComponentType, type LazyExoticComponent, type ReactNode } from "react";
import { Navigate, type RouteObject } from "react-router-dom";
import { appModules } from "@/core/modules/registry";
import type { PageLoader } from "@/core/modules/types";
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
function page(load: PageLoader, fallback: ReactNode): ReactNode {
  let Component = lazyCache.get(load);
  if (!Component) {
    Component = lazy(load);
    lazyCache.set(load, Component);
  }
  return (
    <Suspense fallback={fallback}>
      <Component />
    </Suspense>
  );
}

const panelFallback = <AppLoadingScreen variant="panel" />;
const fullFallback = <AppLoadingScreen />;

const appChildren: RouteObject[] = appModules.flatMap((module) =>
  module.routes.map<RouteObject>((route) => {
    const element = route.redirectTo ? (
      <Navigate to={route.redirectTo} replace />
    ) : route.load ? (
      page(route.load, panelFallback)
    ) : (
      <ModulePlaceholder />
    );
    return route.path === "" ? { index: true, element } : { path: route.path, element };
  })
);

const publicPage = (load: PageLoader) => page(load, fullFallback);

const routes: RouteObject[] = [
  { path: "/", element: publicPage(() => import("../pages/home/page")) },
  { path: "/login", element: publicPage(() => import("../pages/login/page")) },
  { path: "/redefinir-senha", element: publicPage(() => import("../pages/redefinir-senha/page")) },
  { path: "/primeiro-acesso", element: publicPage(() => import("../pages/primeiro-acesso/page")) },
  { path: "/fiscalizacao/:id", element: publicPage(() => import("../pages/fiscalizacao/page")) },
  { path: "/validar/:token", element: publicPage(() => import("../pages/validar/page")) },
  { path: "/votacao/:token", element: publicPage(() => import("../pages/votacao/page")) },
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
