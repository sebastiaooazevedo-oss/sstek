import Modal from "@/pages/app/components/Modal";
import ScanLogTable from "@/pages/app/modules/qrcodes/components/ScanLogTable";
import type { Collaborator } from "@/mocks/collaborators";
import type { ScanLog } from "@/mocks/qrcodes";

interface ScanLogModalProps {
  open: boolean;
  onClose: () => void;
  collaborator: Collaborator | null;
  logs: ScanLog[];
}

export default function ScanLogModal({ open, onClose, collaborator, logs }: ScanLogModalProps) {
  if (!collaborator) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      icon="ri-history-line"
      title="Histórico de escaneamentos"
      subtitle={`QR-Code de ${collaborator.name} · ${logs.length} leitura(s) registrada(s)`}
    >
      <ScanLogTable logs={logs} showCollaborator={false} />
    </Modal>
  );
}