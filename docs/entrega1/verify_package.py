#!/usr/bin/env python3
"""Verificador de integridade do pacote da Entrega 1.

O que faz
---------
1. Le docs/entrega1/ENTREGA1_PACOTE_COMPLETO.txt.
2. Extrai cada bloco delimitado por uma linha "===== FILE: <caminho> =====".
3. Compara o conteudo extraido com o arquivo real do repositorio.
4. Calcula SHA-256 dos dois lados.
5. Escreve docs/entrega1/MANIFESTO_INTEGRIDADE.txt.
6. Retorna codigo 1 se faltar marcador, se algum dos 17 arquivos nao existir
   ou se qualquer bloco divergir.

Regra de normalizacao (aplicada igualmente nos dois lados)
----------------------------------------------------------
O TXT separa blocos com uma linha em branco antes do proximo marcador. Por
isso a comparacao ignora APENAS quebras de linha no fim do bloco
(str.rstrip("\n")). Nenhum outro ajuste e feito: espacos, tabs, acentos,
quebras internas e ordem de linhas sao comparados byte a byte. O manifesto
mostra separadamente o tamanho bruto e o SHA-256 da forma normalizada.

Uso
---
    python3 docs/entrega1/verify_package.py

Nao toca no banco. Nao executa migrations. Nao acessa a rede.
"""

from __future__ import annotations

import hashlib
import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
PACKAGE = REPO_ROOT / "docs" / "entrega1" / "ENTREGA1_PACOTE_COMPLETO.txt"
MANIFEST = REPO_ROOT / "docs" / "entrega1" / "MANIFESTO_INTEGRIDADE.txt"

MARKER_RE = re.compile(r"^===== FILE: (.+?) =====$", re.MULTILINE)
END_OF_BLOCKS = "\n=======================================================================\n§E. FIM DOS BLOCOS"

EXPECTED_BLOCKS = 17


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def normalize(text: str) -> str:
    """Remove apenas quebras de linha finais (separador entre blocos)."""
    return text.rstrip("\n")


def extract_blocks(raw: str) -> dict[str, str]:
    matches = list(MARKER_RE.finditer(raw))
    if not matches:
        raise SystemExit("Nenhum marcador '===== FILE: ... =====' encontrado.")

    end_of_blocks = raw.find(END_OF_BLOCKS)
    blocks: dict[str, str] = {}

    for index, match in enumerate(matches):
        path = match.group(1).strip()
        start = match.end()
        # Pula a quebra de linha imediatamente apos o marcador.
        if raw[start : start + 1] == "\n":
            start += 1

        if index + 1 < len(matches):
            end = matches[index + 1].start()
            # Remove a linha em branco antes do proximo marcador.
            content = raw[start:end]
            if content.endswith("\n\n"):
                content = content[:-1]
        else:
            end = end_of_blocks if end_of_blocks != -1 else len(raw)
            content = raw[start:end]

        if path in blocks:
            raise SystemExit(f"Marcador duplicado no TXT: {path}")
        blocks[path] = content

    return blocks


def main() -> int:
    if not PACKAGE.exists():
        print(f"ERRO: pacote nao encontrado: {PACKAGE}")
        return 1

    raw = PACKAGE.read_text(encoding="utf-8")
    blocks = extract_blocks(raw)

    problems: list[str] = []
    rows: list[tuple[str, int, str, int, str, str]] = []

    if len(blocks) != EXPECTED_BLOCKS:
        problems.append(f"esperados {EXPECTED_BLOCKS} blocos, encontrados {len(blocks)}")

    for path, extracted in blocks.items():
        source = REPO_ROOT / path
        if not source.exists():
            problems.append(f"arquivo de origem ausente: {path}")
            rows.append((path, -1, "-", -1, "-", "AUSENTE"))
            continue

        original_bytes = source.read_bytes()
        original_text = original_bytes.decode("utf-8")

        same = normalize(extracted) == normalize(original_text)
        if not same:
            problems.append(f"bloco divergente: {path}")

        rows.append(
            (
                path,
                len(original_bytes),
                sha256_bytes(original_bytes),
                len(extracted.encode("utf-8")),
                sha256_bytes(normalize(extracted).encode("utf-8")),
                "OK" if same else "DIVERGENTE",
            )
        )

    lines: list[str] = []
    lines.append("MANIFESTO DE INTEGRIDADE — ENTREGA 1")
    lines.append("=" * 71)
    lines.append("")
    lines.append(f"Pacote verificado : {PACKAGE.relative_to(REPO_ROOT)}")
    lines.append(f"Blocos encontrados: {len(blocks)} (esperado: {EXPECTED_BLOCKS})")
    lines.append("Regra de comparacao: conteudo identico apos remover apenas")
    lines.append("quebras de linha finais (separador entre blocos do TXT).")
    lines.append("")
    lines.append("SHA-256 coluna 'origem'  = arquivo real do repositorio")
    lines.append("SHA-256 coluna 'no TXT'  = conteudo extraido do pacote")
    lines.append("")
    header = "| # | caminho | bytes origem | sha256 origem | bytes no TXT | sha256 no TXT | resultado |"
    lines.append(header)
    lines.append("|---|---|---|---|---|---|---|")
    for index, (path, ob, os_, eb, es, status) in enumerate(rows, start=1):
        lines.append(f"| {index} | `{path}` | {ob} | `{os_}` | {eb} | `{es}` | {status} |")
    lines.append("")

    if problems:
        lines.append("RESULTADO: FALHOU")
        lines.append("")
        for problem in problems:
            lines.append(f"  - {problem}")
        lines.append("")
        lines.append("Nao trate o pacote como completo enquanto os itens acima existirem.")
    else:
        lines.append("RESULTADO: PASSOU — os 17 blocos coincidem com os arquivos de origem.")
        lines.append("")
        lines.append("Observacao: isto comprova correspondencia de arquivo, NAO comprova")
        lines.append("comportamento de banco. Nenhum teste do README §12 substitui isto.")

    MANIFEST.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print("\n".join(lines))
    print()
    print(f"Manifesto gravado em: {MANIFEST.relative_to(REPO_ROOT)}")

    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())