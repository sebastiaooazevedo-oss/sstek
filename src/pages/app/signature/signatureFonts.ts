/**
 * Modelos de escrita (assinatura) disponíveis para o colaborador.
 * São quatro tipografias cursivas que reproduzem estilos clássicos de
 * assinatura manuscrita. O colaborador escolhe o modelo e se quer assinar
 * com o nome completo ou apenas o primeiro + último nome.
 */
export type SignatureFontId = "great-vibes" | "allura" | "dancing-script" | "sacramento";

export interface SignatureFont {
  id: SignatureFontId;
  label: string;
  /** Nome real da família tipográfica carregada via Google Fonts. */
  family: string;
  /** Descrição curta exibida no cartão de escolha. */
  description: string;
}

export const signatureFonts: SignatureFont[] = [
  {
    id: "great-vibes",
    label: "Clássica",
    family: "Great Vibes",
    description: "Traço elegante e contínuo",
  },
  {
    id: "allura",
    label: "Formal",
    family: "Allura",
    description: "Cursiva fina e sofisticada",
  },
  {
    id: "dancing-script",
    label: "Fluida",
    family: "Dancing Script",
    description: "Leve e espontânea",
  },
  {
    id: "sacramento",
    label: "Manuscrita",
    family: "Sacramento",
    description: "Delicada e arredondada",
  },
];

export const defaultSignatureFontId: SignatureFontId = "great-vibes";

export function getSignatureFont(id: SignatureFontId): SignatureFont {
  return signatureFonts.find((font) => font.id === id) ?? signatureFonts[0];
}