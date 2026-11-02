-- Retomada por posição de byte na importação da base do CAEPI.
--
-- A importação de arquivos grandes (.csv.gz de ~22 MB) é feita em várias chamadas da
-- função de servidor, porque cada chamada tem tempo/memória limitados. Antes, cada
-- chamada rebaixava e RE-DESCOMPACTAVA o arquivo inteiro do zero e pulava as linhas já
-- processadas — isso estourava a memória/tempo e fazia o servidor ser derrubado no meio
-- (lote terminava em erro "non-2xx"). Agora o arquivo é descompactado UMA ÚNICA VEZ e
-- cada chamada apenas lê o próximo pedaço a partir da posição de byte salva em
-- `resume_offset`. Assim cada rodada processa apenas o seu pedaço, com memória e tempo
-- baixos e constantes, e a importação conclui.
ALTER TABLE public.caepi_import_batches
  ADD COLUMN IF NOT EXISTS resume_offset bigint NOT NULL DEFAULT 0;