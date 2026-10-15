export default function AttendanceFeedback({ register, error }) {
  return (
    <>
      <label htmlFor="feedback" className="eyebrow block mb-2">C. Kritik dan Saran <span className="text-rose-600">*</span></label>
      <p id="feedback-help" className="text-xs text-ink-500 mb-2">
        Wajib diisi untuk evaluasi panitia kegiatan. Maksimal 2000 karakter.
      </p>
      <textarea
        id="feedback"
        className="input min-h-[7rem]"
        rows={4}
        required
        maxLength={2000}
        aria-invalid={Boolean(error)}
        aria-describedby={`feedback-help${error ? ' feedback-error' : ''}`}
        placeholder="Tuliskan kritik dan saran Anda mengenai kegiatan ini."
        {...register('feedback', {
          required: 'Kritik dan Saran wajib diisi.',
          maxLength: { value: 2000, message: 'Kritik dan Saran maksimal 2000 karakter.' },
          validate: (value) => Boolean(value?.trim()) || 'Kritik dan Saran wajib diisi.',
        })}
      />
      {error && <p id="feedback-error" role="alert" className="text-xs text-rose-600 mt-1">{error.message}</p>}
    </>
  )
}
