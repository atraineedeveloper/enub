import { useParams } from "react-router-dom";
import WorkerDocumentsView from "../../features/workers/documents/WorkerDocumentsView";

function WorkerDocuments() {
  const { id } = useParams();
  return <WorkerDocumentsView workerId={Number(id)} />;
}

export default WorkerDocuments;
