import BulkUploadModal from './BulkUploadModal'

// A single final PDF uses the same attended-only preview/review/apply contract.
// It no longer creates participants or requires a certificate number.
export default function UploadCertificateModal(props) {
  return <BulkUploadModal {...props} single />
}
