import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-hot-toast";
import styled from "styled-components";
import {
  HiArrowDownTray,
  HiArrowPath,
  HiArrowUpTray,
  HiEye,
  HiTrash,
} from "react-icons/hi2";

import { useUploadWorkerDocument } from "./useUploadWorkerDocument";
import { useReplaceWorkerDocument } from "./useReplaceWorkerDocument";
import { useDeleteWorkerDocument } from "./useDeleteWorkerDocument";
import { useWorkerDocumentCatalog } from "./useWorkerDocumentCatalog";
import { useWorkerDocumentReportData } from "./useWorkerDocumentReportData";
import { useWorkerDocuments } from "./useWorkerDocuments";
import { useWorkerDocumentsBySemester } from "./useWorkerDocumentsBySemester";
import { generateWorkerDocumentReportPdf } from "./generateWorkerDocumentReportPdf";
import { useSemesters } from "../../semesters/useSemesters";
import { useWorker } from "../useWorker";
import Button from "../../../ui/Button";
import ConfirmDelete from "../../../ui/ConfirmDelete";
import ErrorMessage from "../../../ui/ErrorMessage";
import Heading from "../../../ui/Heading";
import Modal from "../../../ui/Modal";
import Row from "../../../ui/Row";
import Select from "../../../ui/Select";
import Spinner from "../../../ui/Spinner";
import Table from "../../../ui/Table";
import { getWorkerDocumentSignedUrl } from "../../../services/apiWorkerDocuments";

const ACCEPTED_DOCUMENT_TYPES =
  ".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.webp";

const PageHeader = styled.div`
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 2.4rem;
  align-items: end;
  padding-bottom: 1.2rem;
  border-bottom: 1px solid var(--color-grey-200);

  @media (max-width: 700px) {
    grid-template-columns: 1fr;
    align-items: stretch;
  }
`;

const WorkerSummary = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.4rem;

  & span {
    color: var(--color-grey-500);
    font-size: 1.4rem;
  }
`;

const SelectorGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  min-width: 24rem;

  & label {
    font-size: 1.3rem;
    font-weight: 600;
    color: var(--color-grey-600);
  }
`;

const HeaderActions = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1.2rem;
  align-items: stretch;
`;

const Section = styled.section`
  display: flex;
  flex-direction: column;
  gap: 1.6rem;
  padding-top: 0.8rem;
`;

const SectionHeader = styled.div`
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 0.8rem;
  align-items: center;
`;

const SectionHint = styled.p`
  color: var(--color-grey-500);
  font-size: 1.4rem;
`;

const Status = styled.span`
  justify-self: start;
  border-radius: 999px;
  padding: 0.4rem 0.8rem;
  font-size: 1.2rem;
  font-weight: 700;
  color: ${(props) =>
    props.$uploaded ? "var(--color-green-700)" : "var(--color-yellow-700)"};
  background-color: ${(props) =>
    props.$uploaded ? "var(--color-green-100)" : "var(--color-yellow-100)"};
`;

const DocumentList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1rem;
`;

const DocumentFile = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
`;

const FileName = styled.span`
  color: var(--color-grey-700);
  overflow-wrap: anywhere;
`;

const Meta = styled.span`
  color: var(--color-grey-500);
  font-size: 1.2rem;
`;

const FileActions = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.8rem;
`;

const FileLink = styled.button`
  border: none;
  background: none;
  color: var(--color-brand-600);
  font-size: 1.3rem;
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;

  &:hover {
    color: var(--color-brand-700);
  }

  & svg {
    width: 1.5rem;
    height: 1.5rem;
  }
`;

const DangerFileLink = styled(FileLink)`
  color: var(--color-red-700);

  &:hover {
    color: var(--color-red-800);
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const UploadArea = styled.div`
  display: grid;
  grid-template-columns: minmax(16rem, 1fr) auto;
  gap: 0.8rem;
  align-items: center;

  @media (max-width: 700px) {
    grid-template-columns: 1fr;
  }
`;

const UploadControls = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
`;

// Real, functional file input -- kept in the DOM and fully operable, just
// visually hidden. Triggered via a styled Button + ref.click(), the same
// technique CreateEditWorkerForm.jsx already uses for profile_picture, so
// this doesn't introduce a second file-picker pattern in the codebase.
const HiddenFileInput = styled.input`
  display: none;
`;

const FilePicker = styled.div`
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.8rem;
`;

const UploadHint = styled.span`
  color: var(--color-grey-500);
  font-size: 1.2rem;
`;

const EmptyState = styled.p`
  background-color: var(--color-grey-0);
  border: 1px solid var(--color-grey-200);
  border-radius: 7px;
  padding: 1.6rem;
  color: var(--color-grey-600);
`;

function formatDate(value) {
  if (!value) return "";

  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function getDocumentsByType(documents = []) {
  return documents.reduce((acc, document) => {
    const documentsForType = acc.get(document.document_type_id) ?? [];
    documentsForType.push(document);
    acc.set(document.document_type_id, documentsForType);
    return acc;
  }, new Map());
}

function getSemesterLabel(semester) {
  if (!semester) return "";
  return [semester.semester, semester.school_year].filter(Boolean).join(" - ");
}

// eslint-disable-next-line react/prop-types -- workerId is a plain number, passed by both entry points (WorkerDocuments.jsx from useParams, MyDocuments.jsx from useProfile())
function WorkerDocumentsView({ workerId }) {
  const [selectedSemesterId, setSelectedSemesterId] = useState("");
  const [selectedFiles, setSelectedFiles] = useState({});
  const [fileInputVersions, setFileInputVersions] = useState({});
  const fileInputRefs = useRef({});
  const {
    worker,
    isLoading: isLoadingWorker,
    error: workerError,
  } = useWorker(workerId);
  const {
    documentCatalog,
    isLoading: isLoadingCatalog,
    error: catalogError,
  } = useWorkerDocumentCatalog();
  const {
    semesters,
    isLoading: isLoadingSemesters,
    error: semestersError,
  } = useSemesters();
  const {
    workerDocuments: allWorkerDocuments,
    isLoading: isLoadingAllDocuments,
    error: allDocumentsError,
  } = useWorkerDocuments(workerId);
  const {
    workerDocuments: semesterWorkerDocuments,
    isLoading: isLoadingSemesterDocuments,
    error: semesterDocumentsError,
  } = useWorkerDocumentsBySemester(workerId, selectedSemesterId);
  const {
    reportData,
    isLoading: isLoadingReportData,
    error: reportError,
  } = useWorkerDocumentReportData(workerId, selectedSemesterId || null);
  const { uploadDocument, isUploading } = useUploadWorkerDocument();
  const { replaceDocument, isReplacing } = useReplaceWorkerDocument();
  const { deleteDocument, isDeleting } = useDeleteWorkerDocument();

  const permanentCategory = documentCatalog?.find(
    (category) => category.scope === "permanent"
  );
  const semesterCategories =
    documentCatalog?.filter((category) => category.scope === "semester") ?? [];
  const selectedSemester = semesters?.find(
    (semester) => semester.id === Number(selectedSemesterId)
  );
  const workerDocuments = selectedSemesterId
    ? semesterWorkerDocuments
    : allWorkerDocuments;
  const documentsByType = useMemo(
    () => getDocumentsByType(workerDocuments ?? []),
    [workerDocuments]
  );

  useEffect(() => {
    if (!selectedSemesterId && semesters?.length) {
      setSelectedSemesterId(String(semesters[0].id));
    }
  }, [selectedSemesterId, semesters]);

  function handleFileChange(documentTypeId, file) {
    setSelectedFiles((currentFiles) => ({
      ...currentFiles,
      [documentTypeId]: file,
    }));
  }

  function clearFile(documentTypeId) {
    setSelectedFiles((currentFiles) => {
      const nextFiles = { ...currentFiles };
      delete nextFiles[documentTypeId];
      return nextFiles;
    });
    setFileInputVersions((currentVersions) => ({
      ...currentVersions,
      [documentTypeId]: (currentVersions[documentTypeId] ?? 0) + 1,
    }));
  }

  function handleUpload(documentType, existingDocuments, categoryScope) {
    const file = selectedFiles[documentType.id];
    if (!file) return;

    const payload = {
      workerId,
      documentTypeId: documentType.id,
      semesterId:
        categoryScope === "semester" ? Number(selectedSemesterId) : null,
      file,
    };

    const mutationOptions = {
      onSuccess: () => clearFile(documentType.id),
    };

    if (documentType.allows_multiple || !existingDocuments.length) {
      uploadDocument(payload, mutationOptions);
      return;
    }

    replaceDocument(payload, mutationOptions);
  }

  async function handleOpenDocument(storagePath) {
    try {
      const signedUrl = await getWorkerDocumentSignedUrl(storagePath);
      window.open(signedUrl, "_blank", "noopener,noreferrer");
    } catch (error) {
      toast.error(error?.message || "No se pudo abrir el documento");
    }
  }

  async function handleDownloadDocument(document) {
    try {
      const signedUrl = await getWorkerDocumentSignedUrl(document.storage_path);
      const response = await fetch(signedUrl);

      if (!response.ok) {
        throw new Error("No se pudo descargar el documento");
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = window.document.createElement("a");
      link.href = objectUrl;
      link.download = document.file_name;
      link.style.display = "none";
      window.document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch (error) {
      toast.error(error?.message || "No se pudo descargar el documento");
    }
  }

  function handleDownloadReport() {
    if (reportError) {
      toast.error(reportError?.message || "No se pudo cargar el reporte");
      return;
    }

    if (!reportData) {
      toast.error("Los datos del reporte aún no están disponibles");
      return;
    }

    try {
      generateWorkerDocumentReportPdf(reportData);
    } catch (error) {
      toast.error(error?.message || "No se pudo generar el reporte");
    }
  }

  function renderDocumentRows(category) {
    return (
      <Table columns="1.5fr 1fr 2fr 2fr">
        <Table.Header>
          <div>Documento</div>
          <div>Estado</div>
          <div>Archivo</div>
          <div>Acciones</div>
        </Table.Header>
        <Table.Body
          data={category.document_types}
          render={(documentType) => {
            const existingDocuments = documentsByType.get(documentType.id) ?? [];
            const uploaded = existingDocuments.length > 0;
            const selectedFile = selectedFiles[documentType.id];
            const isWorking = isUploading || isReplacing;
            const isReplacingDocument =
              uploaded && !documentType.allows_multiple;
            const actionLabel = documentType.allows_multiple
              ? "Subir evidencia"
              : isReplacingDocument
                ? "Reemplazar archivo"
                : "Subir archivo";
            const pendingLabel = isReplacingDocument
              ? "Reemplazando..."
              : "Subiendo...";
            const fileInputId = `worker-document-${documentType.id}`;

            return (
              <Table.Row key={documentType.id}>
                <div>
                  <FileName>{documentType.name}</FileName>
                  {documentType.allows_multiple && (
                    <Meta>Permite múltiples archivos</Meta>
                  )}
                </div>
                <Status $uploaded={uploaded}>
                  {uploaded ? "Cargado" : "Pendiente"}
                </Status>
                <DocumentList>
                  {uploaded ? (
                    existingDocuments.map((document) => (
                      <DocumentFile key={document.id}>
                        <FileName>{document.file_name}</FileName>
                        <Meta>{formatDate(document.created_at)}</Meta>
                        <FileActions>
                          <FileLink
                            type="button"
                            aria-label={`Ver ${document.file_name}`}
                            onClick={() =>
                              handleOpenDocument(document.storage_path)
                            }
                          >
                            <HiEye /> Ver archivo
                          </FileLink>
                          <FileLink
                            type="button"
                            aria-label={`Descargar ${document.file_name}`}
                            onClick={() => handleDownloadDocument(document)}
                          >
                            <HiArrowDownTray /> Descargar archivo
                          </FileLink>
                          <Modal.Open
                            opens={`delete-worker-document-${document.id}`}
                          >
                            <DangerFileLink
                              type="button"
                              aria-label={`Eliminar ${document.file_name}`}
                              disabled={isDeleting}
                            >
                              <HiTrash /> Eliminar
                            </DangerFileLink>
                          </Modal.Open>
                          <Modal.Window
                            name={`delete-worker-document-${document.id}`}
                          >
                            <ConfirmDelete
                              resourceName={document.file_name}
                              disabled={isDeleting}
                              onConfirm={() => deleteDocument(document.id)}
                            />
                          </Modal.Window>
                        </FileActions>
                      </DocumentFile>
                    ))
                  ) : (
                    <Meta>Sin archivo cargado</Meta>
                  )}
                </DocumentList>
                <UploadArea>
                  <UploadControls>
                    <HiddenFileInput
                      key={`${documentType.id}-${
                        fileInputVersions[documentType.id] ?? 0
                      }`}
                      ref={(element) => {
                        fileInputRefs.current[documentType.id] = element;
                      }}
                      id={fileInputId}
                      type="file"
                      accept={ACCEPTED_DOCUMENT_TYPES}
                      aria-label={`Seleccionar archivo para ${documentType.name}`}
                      disabled={isWorking}
                      onChange={(event) =>
                        handleFileChange(
                          documentType.id,
                          event.target.files?.[0] ?? null
                        )
                      }
                    />
                    <FilePicker>
                      <Button
                        type="button"
                        variation="secondary"
                        size="small"
                        disabled={isWorking}
                        onClick={() =>
                          fileInputRefs.current[documentType.id]?.click()
                        }
                      >
                        Seleccionar archivo
                      </Button>
                      <UploadHint>
                        {selectedFile
                          ? selectedFile.name
                          : "Ningún archivo seleccionado"}
                      </UploadHint>
                    </FilePicker>
                  </UploadControls>
                  <Button
                    size="small"
                    type="button"
                    aria-label={`${actionLabel} para ${documentType.name}`}
                    disabled={!selectedFile || isWorking}
                    onClick={() =>
                      handleUpload(
                        documentType,
                        existingDocuments,
                        category.scope
                      )
                    }
                  >
                    {isWorking ? (
                      <HiArrowPath />
                    ) : documentType.allows_multiple ? (
                      <HiArrowUpTray />
                    ) : (
                      actionLabel
                    )}
                    {isWorking && ` ${pendingLabel}`}
                    {documentType.allows_multiple &&
                      !isWorking &&
                      ` ${actionLabel}`}
                  </Button>
                </UploadArea>
              </Table.Row>
            );
          }}
        />
      </Table>
    );
  }

  const isLoading =
    isLoadingWorker ||
    isLoadingCatalog ||
    isLoadingSemesters ||
    isLoadingAllDocuments ||
    (selectedSemesterId && isLoadingSemesterDocuments);
  const error =
    workerError ||
    catalogError ||
    semestersError ||
    allDocumentsError ||
    semesterDocumentsError;

  if (isLoading) return <Spinner />;
  if (error) return <ErrorMessage message={error.message} />;
  if (!worker) return <ErrorMessage message="El trabajador no existe." />;

  return (
    <Modal>
      <Row>
        <PageHeader>
          <WorkerSummary>
            <Heading as="h1">Expediente documental</Heading>
            <span>{worker.name}</span>
            <span>{worker.type_worker}</span>
          </WorkerSummary>
          <HeaderActions>
            <SelectorGroup>
              <label htmlFor="semester">
                Semestre para documentos académicos
              </label>
              <Select
                id="semester"
                value={selectedSemesterId}
                onChange={(event) => setSelectedSemesterId(event.target.value)}
              >
                {(semesters ?? []).map((semester) => (
                  <option key={semester.id} value={semester.id}>
                    {getSemesterLabel(semester)}
                  </option>
                ))}
              </Select>
            </SelectorGroup>
            <Button
              type="button"
              variation="secondary"
              disabled={isLoadingReportData}
              onClick={handleDownloadReport}
            >
              <HiArrowDownTray /> Descargar reporte
            </Button>
          </HeaderActions>
        </PageHeader>

        {!documentCatalog?.length && (
          <EmptyState>No hay catálogo de documentos configurado.</EmptyState>
        )}

        {permanentCategory && (
          <Section>
            <SectionHeader>
              <Heading as="h2">{permanentCategory.name}</Heading>
              <SectionHint>Documentos permanentes del trabajador</SectionHint>
            </SectionHeader>
            {renderDocumentRows(permanentCategory)}
          </Section>
        )}

        <Section>
          <SectionHeader>
            <Heading as="h2">Documentos por semestre</Heading>
            <SectionHint>
              {selectedSemester
                ? getSemesterLabel(selectedSemester)
                : "Selecciona un semestre"}
            </SectionHint>
          </SectionHeader>
          {!semesters?.length && (
            <EmptyState>
              No hay semestres registrados para cargar documentos académicos.
            </EmptyState>
          )}
          {selectedSemesterId &&
            semesterCategories.map((category) => (
              <Section key={category.id}>
                <Heading as="h3">{category.name}</Heading>
                {renderDocumentRows(category)}
              </Section>
            ))}
        </Section>
      </Row>
    </Modal>
  );
}

export default WorkerDocumentsView;
