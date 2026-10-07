"""Read-only registry over event-owned records; never rewrites other events."""
from collections import defaultdict

from .models import Participant


def normalized_name(value):
    return ' '.join((value or '').split()).casefold()


def empty_history():
    return {'has_certificates': False, 'count': 0, 'events': []}


class IdentityRegistry:
    def __init__(self):
        self.by_nik, self.by_nip, self.by_name = defaultdict(list), defaultdict(list), defaultdict(list)
        self.records = list(Participant.objects.all().only('id', 'event_id', 'nik', 'nip', 'full_name'))
        for p in self.records:
            if p.nik:
                self.by_nik[p.nik].append(p)
            if p.nip:
                self.by_nip[p.nip].append(p)
            self.by_name[normalized_name(p.full_name)].append(p)
        # Batch DB lookup, and at most one storage existence check per PDF.
        from apps.certificates.models import Certificate
        self.certificates = defaultdict(list)
        exists = {}
        for cert in Certificate.objects.filter(status=Certificate.Status.AVAILABLE).exclude(pdf_file='').exclude(pdf_file__isnull=True).select_related('event'):
            filename = cert.pdf_file.name
            if filename not in exists:
                exists[filename] = cert.pdf_file.storage.exists(filename)
            if exists[filename]:
                self.certificates[cert.participant_id].append(cert)

    def resolve(self, row, event_id=None):
        direct = {p.pk: p for p in self.by_nik.get(row.get('nik'), []) + self.by_nip.get(row.get('nip'), [])}
        named = self.by_name.get(normalized_name(row.get('full_name')), [])
        seeds = list({p.pk: p for p in (list(direct.values()) + list(named))}.values())
        components, visited = [], set()
        for seed in seeds:
            if seed.pk in visited:
                continue
            component, pending = {}, [seed]
            while pending:
                p = pending.pop()
                if p.pk in component:
                    continue
                component[p.pk] = p
                visited.add(p.pk)
                pending.extend(self.by_nik.get(p.nik, []) + self.by_nip.get(p.nip, []))
            components.append(component)
        records = [p for component in components for p in component.values()]
        local = [p for p in records if p.event_id == event_id]
        known = {field: {getattr(p, field) for p in records if getattr(p, field)} for field in ('nik', 'nip')}
        names = {normalized_name(p.full_name) for p in records}
        ambiguous = len(components) > 1 or len(local) > 1 or any(len(values) > 1 for values in known.values()) or len(names) > 1
        if ambiguous:
            return {'system_status': 'ambiguous', 'system_record': None, 'correction_fields': [], 'certificate_history': empty_history()}, None
        canonical = None
        if records:
            canonical = {'full_name': records[0].full_name, **{f: next(iter(known[f]), None if f == 'nik' else '') for f in known}}
        corrections = []
        if canonical:
            corrections = [f for f in ('nik', 'nip') if row.get(f) and canonical[f] and row[f] != canonical[f]]
            if direct and normalized_name(row.get('full_name')) != normalized_name(canonical['full_name']):
                corrections.append('full_name')
        status = 'conflict' if corrections else ('existing' if direct else 'new')
        # Name-only records can explain a correction but never supply identity/IDs.
        metadata = {'system_status': status, 'system_record': canonical if status != 'new' else None, 'correction_fields': corrections, 'certificate_history': empty_history()}
        if status == 'existing':
            for field in ('nik', 'nip'):
                if not row.get(field) and canonical[field]:
                    row[field] = canonical[field]
            metadata['certificate_history'] = self.history(records)
        return metadata, local[0] if len(local) == 1 and status == 'existing' else None

    def history(self, records):
        certificates = {cert.pk: cert for p in records for cert in self.certificates.get(p.pk, [])}
        events = {str(cert.event_id): cert.event.title for cert in certificates.values()}
        return {'has_certificates': bool(certificates), 'count': len(certificates), 'events': [{'id': key, 'title': events[key]} for key in sorted(events)]}

    def participant_history(self, participant):
        row = {f: getattr(participant, f) for f in ('nik', 'nip', 'full_name')}
        metadata, _ = self.resolve(row)
        return metadata['certificate_history']
