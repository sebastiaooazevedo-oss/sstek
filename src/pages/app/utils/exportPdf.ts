import { addExportEntry, type ExportSealInfo } from "@/pages/app/utils/exportHistory";
import { getSettings } from "@/pages/app/settings/settingsStore";

/**
 * Exportação em PDF sem dependências externas.
 * Monta um documento isolado (estilo "impresso") em um iframe oculto e
 * aciona a impressão do navegador, onde o usuário escolhe "Salvar como PDF".
 * Cada emissão é registrada no histórico de exportações da sessão.
 */

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function todayBr(): string {
  return new Date().toLocaleDateString("pt-BR");
}

const printStyles = `
  :root {
    --background-50: 0.99 0.004 150;
    --background-300: 0.9 0.01 150;
    --foreground-300: 0.74 0.01 155;
    --foreground-400: 0.61 0.012 155;
    --primary-500: 0.6 0.17 150;
    --accent-500: 0.76 0.18 70;
    --secondary-700: 0.39 0.07 178;
  }
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color: #1c2a33; margin: 0; padding: 8px; }
  .doc-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; border-bottom: 3px solid #17423a; padding-bottom: 14px; margin-bottom: 20px; }
  .brand { font-size: 22px; font-weight: 800; letter-spacing: 1px; color: #17423a; }
  .brand span { color: #2f9e6b; }
  .brand small { display: block; font-size: 9px; letter-spacing: 1.6px; color: #6b7a80; margin-top: 2px; font-weight: 600; }
  .doc-head .meta { text-align: right; font-size: 11px; color: #5b6b73; line-height: 1.6; }
  .letterhead { display: block; width: 100%; max-height: 40mm; height: auto; object-fit: contain; object-position: left top; margin: 0 0 8px; }
  /* Papel timbrado enviado como folha inteira: em vez de ocupar uma pagina
     inteira (o que empurrava ou escondia o conteudo), ele e recortado como
     faixa de cabecalho. E uma imagem normal no fluxo do documento, portanto
     imprime sempre, independente das opcoes da caixa de impressao, e nunca
     fica por cima do texto. */
  .letterhead.is-sheet {
    width: 100%;
    height: 42mm;
    max-height: none;
    object-fit: cover;
    object-position: top center;
    margin: 0 0 10px;
  }
  .doc-flow { position: relative; }
  .letterhead-bar { display: flex; align-items: center; justify-content: space-between; gap: 16px; font-size: 10px; text-transform: uppercase; letter-spacing: .4px; color: #5b6b73; border-bottom: 2px solid #17423a; padding-bottom: 8px; margin-bottom: 18px; }
  .company-line { font-size: 10px; letter-spacing: .3px; color: #3c4a51; margin: -2px 0 16px; text-transform: uppercase; }
  .company-line strong { color: #17423a; }
  h1 { font-size: 18px; margin: 0 0 4px; color: #17423a; }
  h2 { font-size: 13px; margin: 22px 0 8px; border-left: 4px solid #2f9e6b; padding-left: 8px; color: #17423a; text-transform: uppercase; letter-spacing: .5px; }
  .muted { color: #5b6b73; font-size: 12px; }
  .grid { display: flex; flex-wrap: wrap; gap: 10px 30px; margin: 12px 0 4px; font-size: 13px; }
  .grid div strong { color: #17423a; }
  table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 12px; }
  th, td { border: 1px solid #c9d3d7; padding: 7px 9px; text-align: left; vertical-align: middle; }
  th { background: #eef3f1; font-size: 10px; text-transform: uppercase; letter-spacing: .4px; color: #3c4a51; }
  .sign img { height: 40px; display: block; }
  .sign .empty { color: #9aa6ac; font-style: italic; }
  .kpis { display: flex; gap: 12px; flex-wrap: wrap; margin: 16px 0; }
  .kpi { border: 1px solid #c9d3d7; border-radius: 8px; padding: 10px 16px; min-width: 140px; }
  .kpi b { display: block; font-size: 20px; color: #17423a; }
  .kpi span { font-size: 11px; color: #5b6b73; }
  .foot { margin-top: 12px; font-size: 11px; color: #5b6b73; display: flex; justify-content: space-between; border-top: 1px solid #c9d3d7; padding-top: 10px; }
  .foot-verify { margin-top: 12px; border: 1px solid #c9d3d7; border-left: 4px solid #17423a; border-radius: 0 8px 8px 0; padding: 8px 12px; background: #f4f8f6; page-break-inside: avoid; }
  .foot-verify-label { display: block; font-size: 7.5px; text-transform: uppercase; letter-spacing: .9px; color: #5b6b73; font-weight: 700; }
  .foot-url { display: block; margin-top: 3px; font-family: "Courier New", Courier, monospace; font-size: 11px; font-weight: 700; color: #17423a; word-break: break-all; letter-spacing: .2px; }
  .chart { margin: 8px 0 14px; border: 1px solid #c9d3d7; border-radius: 8px; padding: 10px 12px; page-break-inside: avoid; }
  .chart svg { width: 100%; height: auto; display: block; }
  .sign-block { display: flex; gap: 30px; margin-top: 46px; page-break-inside: avoid; }
  .sign-field { flex: 1; }
  .sign-field.sign-date { flex: 0 0 150px; }
  .sign-line { height: 40px; border-bottom: 1px solid #5b6b73; }
  .sign-img { display: flex; align-items: flex-end; justify-content: center; height: 44px; }
  .sign-img img { max-height: 44px; display: block; }
  .sign-caption { display: block; margin-top: 6px; font-size: 10px; color: #5b6b73; text-align: center; }
  .sign-meta { display: block; margin-top: 2px; font-size: 8px; color: #6b7a80; text-align: center; }
  .esign-grid { display: flex; flex-wrap: wrap; gap: 14px; margin-top: 10px; }
  .esign-cell { flex: 1 1 44%; min-width: 200px; border: 1px solid #c9d3d7; border-radius: 8px; padding: 10px 12px; page-break-inside: avoid; }
  .esign { text-align: center; }
  .esign img { height: 42px; margin: 0 auto 4px; display: block; }
  .esign-empty { height: 42px; display: flex; align-items: center; justify-content: center; font-size: 9px; font-style: italic; color: #9aa6ac; }
  .esign-fallback { height: 42px; display: flex; align-items: center; justify-content: center; font-size: 17px; font-style: italic; color: #17423a; letter-spacing: .3px; }
  .esign-cap { font-size: 8px; text-transform: uppercase; letter-spacing: .4px; color: #6b7a80; margin-top: 4px; }
  .esign-name { font-size: 11px; font-weight: 700; color: #17423a; text-transform: uppercase; }
  .esign-meta { font-size: 8px; color: #5b6b73; word-break: break-all; }
  .qr-box { display: flex; gap: 16px; align-items: center; border: 1px solid #c9d3d7; border-radius: 8px; padding: 12px 16px; margin-top: 10px; }
  .qr-img { width: 132px; height: 132px; }
  .qr-url { font-size: 11px; font-weight: 600; color: #17423a; word-break: break-all; margin: 0; }
  .seal { display: flex; gap: 10px; align-items: center; border: 1.5px solid #17423a; border-radius: 8px; padding: 8px 10px; margin-top: 14px; background: #f6faf8; page-break-inside: avoid; }
  .seal-qr { flex: 0 0 auto; width: 20mm; text-align: center; }
  .seal-qr-img { width: 20mm; height: 20mm; display: block; }
  .seal-qr-cap { display: block; margin-top: 2px; font-size: 6.5px; text-transform: uppercase; letter-spacing: .4px; color: #5b6b73; }
  .seal-body { flex: 1 1 auto; min-width: 0; border-left: 1px dashed #9aa6ac; padding-left: 10px; }
  .seal-kicker { font-size: 6.8px; letter-spacing: .9px; text-transform: uppercase; color: #2f9e6b; font-weight: 700; }
  .seal-title { font-size: 10.5px; font-weight: 800; letter-spacing: .5px; text-transform: uppercase; color: #17423a; margin-top: 1px; line-height: 1.25; }
  .seal-doc { font-size: 8.5px; color: #3c4a51; margin-top: 2px; }
  .seal-rows { display: flex; flex-wrap: wrap; gap: 0 12px; margin-top: 4px; font-size: 7px; line-height: 1.45; color: #3c4a51; }
  .seal-rows b { color: #17423a; }
  .seal-link { margin-top: 3px; font-size: 6.8px; line-height: 1.4; color: #5b6b73; word-break: break-all; }
  .seal-note { margin-top: 4px; font-size: 6.8px; line-height: 1.4; color: #6b7a80; page-break-before: avoid; }
  .photo-grid { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 10px; }
  .photo-grid figure { flex: 1 1 30%; min-width: 150px; margin: 0; border: 1px solid #c9d3d7; border-radius: 8px; overflow: hidden; page-break-inside: avoid; }
  .photo-grid img { width: 100%; height: 130px; object-fit: cover; display: block; }
  .photo-grid figcaption { font-size: 9px; color: #5b6b73; padding: 4px 6px; }
  .cover { page-break-after: always; }
  .batch-page { page-break-after: always; }
  .batch-page:last-child { page-break-after: auto; }
  .cover-hero { border-left: 6px solid #2f9e6b; background: #f4f8f6; padding: 22px 24px; margin: 26px 0 22px; border-radius: 10px; }
  .cover-eyebrow { font-size: 10px; letter-spacing: 1.6px; text-transform: uppercase; color: #2f9e6b; font-weight: 700; margin: 0 0 8px; }
  .cover-title { font-size: 30px; line-height: 1.15; color: #17423a; margin: 0 0 10px; }
  .cover-sub { font-size: 13px; color: #3c4a51; margin: 0 0 4px; }
  .cover-date { font-size: 12px; color: #5b6b73; margin: 0; font-weight: 600; }
  .cover-kpis { display: flex; gap: 14px; flex-wrap: wrap; margin: 22px 0; }
  .cover-kpi { flex: 1 1 150px; border: 1px solid #c9d3d7; border-radius: 10px; padding: 16px 18px; background: #ffffff; }
  .cover-kpi b { display: block; font-size: 30px; line-height: 1; color: #17423a; }
  .cover-kpi span { display: block; margin-top: 6px; font-size: 11px; color: #5b6b73; }
  .cover-kpi.is-alert b { color: #b45309; }
  .nrs-box { margin: 12px 0 4px; border: 1px solid #c9d3d7; border-radius: 10px; padding: 14px 16px; page-break-inside: avoid; }
  .nrs-box.is-ok { border-color: #9ed3b6; background: #eef8f1; }
  .nrs-box.is-alert { border-color: #e9c07a; background: #fdf6ee; }
  .nrs-box.is-dispensa { border-color: #c9d3d7; background: #f4f8f6; }
  .nrs-box-head { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px; }
  .nrs-seal { display: inline-flex; align-items: center; border-radius: 999px; padding: 6px 14px; font-size: 12px; font-weight: 800; letter-spacing: .4px; text-transform: uppercase; border: 2px solid #c9d3d7; }
  .nrs-seal.is-ok { color: #17423a; border-color: #2f9e6b; background: #ffffff; }
  .nrs-seal.is-alert { color: #b45309; border-color: #d97706; background: #ffffff; }
  .nrs-seal.is-dispensa { color: #5b6b73; border-color: #c9d3d7; background: #ffffff; }
  .nrs-box-scale { font-size: 11px; font-weight: 700; color: #3c4a51; }
  .nrs-box-text { margin: 10px 0 0; font-size: 12px; color: #3c4a51; line-height: 1.5; }
  .nrs-box-text strong { color: #17423a; }
  .cover-list { margin: 10px 0 0; padding-left: 18px; font-size: 12.5px; color: #3c4a51; }
  .cover-list li { margin-bottom: 7px; }
  .cover-list strong { color: #17423a; }
  .cover-note { margin-top: 22px; border-left: 4px solid #d97706; background: #fdf6ee; padding: 12px 16px; font-size: 12px; color: #3c4a51; border-radius: 0 8px 8px 0; }
  .cover-head { position: relative; }
  .publish-stamp { position: absolute; top: -4px; right: 12px; z-index: 3; border: 3px double #b45309; color: #b45309; border-radius: 10px; padding: 7px 20px; text-align: center; transform: rotate(-7deg); background: rgba(255, 255, 255, 0.72); page-break-inside: avoid; }
  .publish-stamp-label { display: block; font-size: 17px; font-weight: 800; letter-spacing: 3px; text-transform: uppercase; line-height: 1.1; }
  .publish-stamp-date { display: block; margin-top: 2px; font-size: 10px; font-weight: 700; letter-spacing: 1px; }
  .cover-meta { margin-top: 26px; font-size: 11px; color: #5b6b73; display: flex; justify-content: space-between; border-top: 1px solid #c9d3d7; padding-top: 10px; }
  @page {
    size: A4;
    margin: 14mm 12mm 20mm;
    @bottom-right {
      content: "Página " counter(page) " de " counter(pages);
      font-family: Arial, Helvetica, sans-serif;
      font-size: 8px;
      color: #6b7a80;
    }
  }
  @media print { body { padding: 0; } }
`;

export interface PrintOptions {
  /** Desliga o registro no histórico (usado pelo replay, para não duplicar). */
  record?: boolean;
  /** Nome de quem está emitindo/baixando o arquivo. */
  actor?: string;
  /** Chancela registrada para este PDF (quando o documento sai chancelado). */
  seal?: ExportSealInfo;
}

/**
 * Monta um documento HTML completo (mesmo layout do PDF) para ser exibido em
 * um iframe de pré-visualização — usado para o Responsável Técnico conferir o
 * documento antes de assinar eletronicamente. Não imprime nada.
 */
export function buildDocumentPreviewHtml(title: string, bodyHtml: string): string {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${escapeHtml(
    title
  )}</title><style>${printStyles}</style><style>body{background:#ffffff;padding:12px;} .batch-page{page-break-after:auto;}</style></head><body><div class="doc-flow">${bodyHtml}</div></body></html>`;
}

export function printHtml(title: string, bodyHtml: string, options?: PrintOptions): void {
  if (options?.record !== false) {
    addExportEntry({
      label: title,
      kind: "pdf",
      actor: options?.actor,
      seal: options?.seal,
      replay: () => printHtml(title, bodyHtml, { record: false }),
    });
  }

  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  document.body.appendChild(iframe);

  const win = iframe.contentWindow;
  const doc = win?.document;
  if (!win || !doc) {
    document.body.removeChild(iframe);
    return;
  }

  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${escapeHtml(
    title
  )}</title><style>${printStyles}</style></head><body><div class="doc-flow">${bodyHtml}</div></body></html>`;

  doc.open();
  doc.write(html);
  doc.close();

  const cleanup = () => {
    window.setTimeout(() => {
      if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
    }, 1500);
  };

  /**
   * O papel timbrado costuma ser enviado como uma folha A4 inteira. Impresso
   * no fluxo, ele ocuparia a primeira pagina sozinho e empurraria o conteudo.
   * Detectamos a proporcao da imagem: folha inteira e recortada como faixa de
   * cabecalho (topo do timbre, onde ficam logo e dados da empresa); imagens
   * em faixa continuam como cabecalho normal.
   */
  const applyLetterheadLayout = () => {
    const img = doc.querySelector<HTMLImageElement>("img.letterhead");
    if (!img || !img.naturalWidth || !img.naturalHeight) return;
    const ratio = img.naturalHeight / img.naturalWidth;
    if (ratio < 1.15) return;
    // Folha inteira: recorta o topo do timbre (onde ficam logo e dados da
    // empresa) como faixa de cabecalho. Nenhum ajuste de pagina, nenhuma
    // camada fixa, nenhum fundo: o texto sempre imprime abaixo da faixa.
    img.classList.add("is-sheet");
  };

  /** Espera as imagens (timbre, assinaturas, fotos) antes de disparar a impressao. */
  const waitForAssets = () =>
    new Promise<void>((resolve) => {
      const pending = Array.from(doc.images).filter((img) => !img.complete);
      if (pending.length === 0) {
        resolve();
        return;
      }
      let remaining = pending.length;
      const finish = () => {
        remaining -= 1;
        if (remaining <= 0) resolve();
      };
      pending.forEach((img) => {
        img.addEventListener("load", finish, { once: true });
        img.addEventListener("error", finish, { once: true });
      });
      // Nao trava a impressao se algum arquivo externo demorar demais.
      window.setTimeout(resolve, 1800);
    });

  /**
   * O QR-Code da chancela e gerado como SVG em data URL. O motor de impressao
   * do Chrome frequentemente nao rasteriza SVG dentro de <img> ao gerar o PDF,
   * e o QR sai em branco. Desenhamos o SVG num canvas e trocamos por PNG antes
   * de imprimir — assim o QR sempre aparece no papel.
   */
  const rasterizeSvgDataUrls = async (): Promise<void> => {
    const targets = Array.from(
      doc.querySelectorAll<HTMLImageElement>('img[src^="data:image/svg+xml"]')
    );
    if (targets.length === 0) return;
    await Promise.all(
      targets.map(
        (img) =>
          new Promise<void>((resolve) => {
            const src = img.getAttribute("src") || "";
            const comma = src.indexOf(",");
            if (comma < 0) {
              resolve();
              return;
            }
            let markup = src.slice(comma + 1);
            if (src.slice(0, comma).includes(";base64")) {
              try {
                markup = atob(markup);
              } catch {
                resolve();
                return;
              }
            } else {
              try {
                markup = decodeURIComponent(markup);
              } catch {
                // mantem o conteudo original se a decodificacao falhar
              }
            }
            const width = Number(/width=["'](\d+(?:\.\d+)?)/.exec(markup)?.[1] || 0) || 132;
            const height = Number(/height=["'](\d+(?:\.\d+)?)/.exec(markup)?.[1] || 0) || width;
            // SVG carregado como imagem exige o namespace declarado explicitamente.
            let sanitized = markup;
            if (!/xmlns=/.test(sanitized.slice(0, 220))) {
              sanitized = sanitized.replace(/<svg/i, '<svg xmlns="http://www.w3.org/2000/svg"');
            }
            const loaderSrc = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(sanitized)}`;
            const loader = new Image();
            loader.onload = () => {
              try {
                const scale = 4;
                const canvas = doc.createElement("canvas");
                canvas.width = Math.round(width * scale);
                canvas.height = Math.round(height * scale);
                const ctx = canvas.getContext("2d");
                if (!ctx) {
                  resolve();
                  return;
                }
                ctx.fillStyle = "#ffffff";
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(loader, 0, 0, canvas.width, canvas.height);
                img.setAttribute("src", canvas.toDataURL("image/png"));
              } catch {
                // se o canvas falhar, mantemos o SVG original
              }
              resolve();
            };
            loader.onerror = () => resolve();
            loader.src = loaderSrc;
          })
      )
    );
  };

  let printed = false;
  const trigger = () => {
    if (printed) return;
    printed = true;
    try {
      win.focus();
      win.print();
    } finally {
      cleanup();
    }
  };

  void (async () => {
    await rasterizeSvgDataUrls();
    await waitForAssets();
    applyLetterheadLayout();
    window.setTimeout(trigger, 150);
  })();
}

export function pdfHeader(rightLabel: string): string {
  const settings = getSettings();
  const letterhead = settings.letterheadUrl;
  const companyName = settings.companyLegalName.trim();
  const cnpj = settings.companyCnpj.trim();

  const companyParts: string[] = [];
  if (companyName) companyParts.push(`<strong>${escapeHtml(companyName)}</strong>`);
  if (cnpj) companyParts.push(`CNPJ ${escapeHtml(cnpj)}`);
  const companyLine = companyParts.length
    ? `<div class="company-line">${companyParts.join(" · ")}</div>`
    : "";

  if (letterhead) {
    return `<img class="letterhead" src="${escapeHtml(letterhead)}" alt="Papel timbrado da empresa" />
    ${companyLine}
    <div class="letterhead-bar"><span>${escapeHtml(rightLabel)}</span><span>Emitido em ${todayBr()}</span></div>`;
  }

  const brandHtml = companyName
    ? `<div class="brand">${escapeHtml(companyName)}${cnpj ? `<small>CNPJ ${escapeHtml(cnpj)}</small>` : ""}</div>`
    : `<div class="brand">SST<span>EK</span><small>GESTÃO INTELIGENTE EM SEGURANÇA DO TRABALHO</small></div>`;

  return `<div class="doc-head">
    ${brandHtml}
    <div class="meta">${escapeHtml(rightLabel)}<br/>Emitido em ${todayBr()}</div>
  </div>`;
}

export interface TechnicalSignatureInfo {
  /** Nome de quem assina como responsável técnico. */
  name?: string;
  /** Representação visual da assinatura eletrônica (data URL / URL). */
  image?: string | null;
  /** Data/hora da assinatura eletrônica (ISO). */
  signedAt?: string | null;
  /** Identificador único da assinatura eletrônica. */
  signatureUid?: string | null;
}

function formatSignatureStamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function pdfFooter(
  sealHtml = "",
  validationUrl = "",
  technical?: TechnicalSignatureInfo
): string {
  const settings = getSettings();
  const responsible = (technical?.name || settings.technicalResponsible).trim();
  const registration = settings.technicalRegistration.trim();
  const signLabel = responsible
    ? `${escapeHtml(responsible)}${registration ? ` · ${escapeHtml(registration)}` : ""}`
    : "Responsável Técnico de Segurança do Trabalho";

  const signatureImage = technical?.image
    ? `<div class="sign-img"><img src="${escapeHtml(technical.image)}" alt="Assinatura eletrônica de ${escapeHtml(
        responsible || "responsável técnico"
      )}" /></div>`
    : `<div class="sign-line"></div>`;

  const signatureMeta = [
    technical?.signedAt
      ? `<span class="sign-meta">Assinado eletronicamente em ${escapeHtml(formatSignatureStamp(technical.signedAt))}</span>`
      : "",
    technical?.signatureUid
      ? `<span class="sign-meta">ID da assinatura: ${escapeHtml(technical.signatureUid)}</span>`
      : "",
  ]
    .filter(Boolean)
    .join("");

  return `<div class="sign-block">
    <div class="sign-field">
      ${signatureImage}
      <span class="sign-caption">${signLabel}</span>
      ${signatureMeta}
    </div>
  </div>
  ${sealHtml}
  ${
    validationUrl
      ? `<div class="foot-verify"><span class="foot-verify-label">Endereço completo de validação — confira este documento em papel</span><span class="foot-url">${escapeHtml(
          validationUrl
        )}</span></div>`
      : ""
  }
  <div class="foot"><span>SSTEK · Gestão Inteligente em Segurança do Trabalho</span><span>Emitido em ${todayBr()}</span></div>`;
}