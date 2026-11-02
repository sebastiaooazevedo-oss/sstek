import { Navigate, type RouteObject } from "react-router-dom";
import NotFound from "../pages/NotFound";
import Home from "../pages/home/page";
import Login from "../pages/login/page";
import RedefinirSenha from "../pages/redefinir-senha/page";
import PrimeiroAcesso from "../pages/primeiro-acesso/page";
import AppLayout from "../pages/app/layout";
import AppDashboard from "../pages/app/page";
import ModulePlaceholder from "../pages/app/components/ModulePlaceholder";
import ColaboradoresPage from "../pages/app/modules/colaboradores/page";
import DocumentosPage from "../pages/app/modules/documentos/page";
import VeiculosPage from "../pages/app/modules/veiculos/page";
import BatchPrintConferencePage from "../pages/app/modules/documentos/BatchPrintConferencePage";
import BatchPrintHistoryPage from "../pages/app/modules/documentos/BatchPrintHistoryPage";
import RegulamentoPage from "../pages/app/modules/regulamento/page";
import DdsPage from "../pages/app/modules/dds/page";
import EpiPage from "../pages/app/modules/epi/page";
import AprPage from "../pages/app/modules/apr/page";
import QrCodesPage from "../pages/app/modules/qrcodes/page";
import QrRenewalAuditPage from "../pages/app/modules/qrcodes/RenewalAuditPage";
import QrConsultasExternasPage from "../pages/app/modules/qrcodes/ConsultasExternasPage";
import QrLogsPage from "../pages/app/modules/qrlogs/page";
import ConfigPage from "../pages/app/modules/config/page";
import PerfisAcessoPage from "../pages/app/modules/perfis/page";
import PerfilPage from "../pages/app/modules/perfil/page";
import MeusDocumentosPage from "../pages/app/modules/meusdocumentos/page";
import MinhaEpiPage from "../pages/app/modules/minhaepi/page";
import MinhaEquipePage from "../pages/app/modules/minhaequipe/page";
import AlertasPage from "../pages/app/modules/alertas/page";
import AssinaturasPage from "../pages/app/modules/assinaturas/page";
import AssinadosPage from "../pages/app/modules/assinados/page";
import PoliticasPage from "../pages/app/modules/politicas/page";
import SentimentoPage from "../pages/app/modules/sentimento/page";
import CipaPage from "../pages/app/modules/cipa/page";
import PesquisasPage from "../pages/app/modules/pesquisas/page";
import PlataformaPage from "../pages/app/modules/plataforma/page";
import ParametrizacaoPage from "../pages/app/modules/plataforma/pages/ParametrizacaoPage";
import PerfisPage from "../pages/app/modules/plataforma/pages/PerfisPage";
import LicencasPage from "../pages/app/modules/plataforma/pages/LicencasPage";
import PagamentosPage from "../pages/app/modules/plataforma/pages/PagamentosPage";
import ImportacaoPage from "../pages/app/modules/plataforma/pages/ImportacaoPage";
import LogsPage from "../pages/app/modules/plataforma/pages/LogsPage";
import FiscalizacaoPage from "../pages/fiscalizacao/page";
import ValidarPage from "../pages/validar/page";
import VotacaoPage from "../pages/votacao/page";

const routes: RouteObject[] = [
  {
    path: "/",
    element: <Home />,
  },
  {
    path: "/login",
    element: <Login />,
  },
  {
    path: "/redefinir-senha",
    element: <RedefinirSenha />,
  },
  {
    path: "/primeiro-acesso",
    element: <PrimeiroAcesso />,
  },
  {
    path: "/fiscalizacao/:id",
    element: <FiscalizacaoPage />,
  },
  {
    path: "/validar/:token",
    element: <ValidarPage />,
  },
  {
    path: "/votacao/:token",
    element: <VotacaoPage />,
  },
  {
    path: "/app",
    element: <AppLayout />,
    children: [
      {
        index: true,
        element: <AppDashboard />,
      },
      {
        path: "colaboradores",
        element: <ColaboradoresPage />,
      },
      {
        path: "documentos",
        element: <DocumentosPage />,
      },
      {
        path: "veiculos",
        element: <VeiculosPage />,
      },
      {
        path: "documentos/impressao-em-lote",
        element: <BatchPrintConferencePage />,
      },
      {
        path: "documentos/lotes",
        element: <BatchPrintHistoryPage />,
      },
      {
        path: "regulamento",
        element: <RegulamentoPage />,
      },
      {
        path: "dds",
        element: <DdsPage />,
      },
      {
        path: "epi",
        element: <EpiPage />,
      },
      {
        path: "apr",
        element: <AprPage />,
      },
      {
        path: "qrcodes",
        element: <QrCodesPage />,
      },
      {
        path: "qrcodes/renovacoes",
        element: <QrRenewalAuditPage />,
      },
      {
        path: "qrcodes/consultas",
        element: <QrConsultasExternasPage />,
      },
      {
        path: "meusdados",
        element: <PerfilPage />,
      },
      {
        path: "meusdocumentos",
        element: <MeusDocumentosPage />,
      },
      {
        path: "minhaepi",
        element: <MinhaEpiPage />,
      },
      {
        path: "minhaequipe",
        element: <MinhaEquipePage />,
      },
      {
        path: "assinaturas",
        element: <AssinaturasPage />,
      },
      {
        path: "documentos-assinados",
        element: <AssinadosPage />,
      },
      {
        path: "politicas",
        element: <PoliticasPage />,
      },
      {
        path: "sentimento",
        element: <SentimentoPage />,
      },
      {
        path: "cipa",
        element: <CipaPage />,
      },
      {
        path: "pesquisas",
        element: <PesquisasPage />,
      },
      {
        // Endereço antigo de "Avaliações" — mantido como atalho para Pesquisas.
        path: "avaliacoes",
        element: <Navigate to="/app/pesquisas" replace />,
      },
      {
        path: "alertas",
        element: <AlertasPage />,
      },
      {
        path: "qrlogs",
        element: <QrLogsPage />,
      },
      {
        path: "empresas",
        element: <PlataformaPage />,
      },
      {
        path: "plataforma",
        element: <PlataformaPage />,
      },
      {
        path: "plataforma/parametrizacao",
        element: <ParametrizacaoPage />,
      },
      {
        path: "plataforma/perfis",
        element: <PerfisPage />,
      },
      {
        path: "plataforma/licencas",
        element: <LicencasPage />,
      },
      {
        path: "plataforma/pagamentos",
        element: <PagamentosPage />,
      },
      {
        path: "plataforma/importacao",
        element: <ImportacaoPage />,
      },
      {
        path: "plataforma/logs",
        element: <LogsPage />,
      },
      {
        path: "perfis",
        element: <PerfisAcessoPage />,
      },
      {
        path: "config",
        element: <ConfigPage />,
      },
      {
        path: ":module",
        element: <ModulePlaceholder />,
      },
    ],
  },
  {
    path: "*",
    element: <NotFound />,
  },
];

export default routes;