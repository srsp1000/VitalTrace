import React, { useState, useMemo } from 'react';
import { 
  Calendar, 
  FileText, 
  Filter, 
  Search, 
  ExternalLink, 
  ArrowUpRight, 
  ArrowDownRight, 
  CheckCircle,
  HelpCircle
} from 'lucide-react';
import { useHealthData } from '../../context/HealthDataContext';

export const TimelineScreen: React.FC = () => {
  const { 
    observations, 
    documents, 
    setSelectedDocumentIdFilter, 
    setActiveScreen 
  } = useHealthData();

  const [selectedTest, setSelectedTest] = useState<string>('all');
  const [selectedDoc, setSelectedDoc] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');

  // Extract unique canonical tests
  const uniqueTests = useMemo(() => {
    const set = new Set<string>();
    observations.forEach(o => set.add(o.canonicalTestName));
    return Array.from(set).sort();
  }, [observations]);

  // Filter confirmed observations
  const timelineObservations = useMemo(() => {
    return observations
      .filter(obs => {
        // Only show confirmed or verified observations in Health Timeline
        if (obs.verifiedByUser !== 'confirmed') return false;

        const matchesTest = selectedTest === 'all' || obs.canonicalTestName === selectedTest;
        const matchesDoc = selectedDoc === 'all' || obs.documentId === selectedDoc;
        const matchesSearch = !searchQuery || 
          obs.canonicalTestName.toLowerCase().includes(searchQuery.toLowerCase()) ||
          obs.rawTestName.toLowerCase().includes(searchQuery.toLowerCase());
        
        const matchesDateStart = !dateStart || obs.observationDate >= dateStart;
        const matchesDateEnd = !dateEnd || obs.observationDate <= dateEnd;

        return matchesTest && matchesDoc && matchesSearch && matchesDateStart && matchesDateEnd;
      })
      .sort((a, b) => new Date(b.observationDate).getTime() - new Date(a.observationDate).getTime());
  }, [observations, selectedTest, selectedDoc, searchQuery, dateStart, dateEnd]);

  // Group by observation date
  const groupedByDate = useMemo(() => {
    const groups: Record<string, typeof timelineObservations> = {};
    timelineObservations.forEach(obs => {
      if (!groups[obs.observationDate]) {
        groups[obs.observationDate] = [];
      }
      groups[obs.observationDate].push(obs);
    });
    return groups;
  }, [timelineObservations]);

  return (
    <div className="space-y-6">
      {/* Overview Banner */}
      <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-subtle flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            Longitudinal Health Timeline
            <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-teal-50 text-teal-700 border border-teal-200">
              {timelineObservations.length} Confirmed Records
            </span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Chronological log of verified biometric measurements with full provenance back to original laboratory reports.
          </p>
        </div>

        <button
          onClick={() => setActiveScreen('trends')}
          className="text-xs font-semibold text-teal-700 hover:text-teal-800 bg-teal-50 hover:bg-teal-100/80 px-3 py-1.5 rounded-md border border-teal-200 transition-colors shrink-0"
        >
          View Trajectory Trends →
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-subtle space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search confirmed observation..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-xs pl-8 pr-3 py-1.5 rounded-md border border-slate-300 focus:outline-none focus:ring-1 focus:ring-teal-500"
            />
          </div>

          {/* Test selector */}
          <div className="flex items-center gap-1.5 text-xs text-slate-600">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={selectedTest}
              onChange={(e) => setSelectedTest(e.target.value)}
              className="text-xs rounded border border-slate-300 px-2 py-1.5 bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-500"
            >
              <option value="all">All Biomarkers ({uniqueTests.length})</option>
              {uniqueTests.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          {/* Document selector */}
          <div className="flex items-center gap-1.5 text-xs text-slate-600">
            <FileText className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={selectedDoc}
              onChange={(e) => setSelectedDoc(e.target.value)}
              className="text-xs rounded border border-slate-300 px-2 py-1.5 bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-500"
            >
              <option value="all">All Source Docs ({documents.length})</option>
              {documents.map(d => (
                <option key={d.id} value={d.id}>
                  {d.originalFilename.length > 25 ? d.originalFilename.slice(0, 25) + '...' : d.originalFilename}
                </option>
              ))}
            </select>
          </div>

          {/* Date range */}
          <div className="flex items-center gap-1.5 text-xs text-slate-600 font-mono">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <input
              type="date"
              value={dateStart}
              onChange={(e) => setDateStart(e.target.value)}
              className="text-xs rounded border border-slate-300 px-2 py-1 bg-white"
            />
            <span>to</span>
            <input
              type="date"
              value={dateEnd}
              onChange={(e) => setDateEnd(e.target.value)}
              className="text-xs rounded border border-slate-300 px-2 py-1 bg-white"
            />
          </div>
        </div>
      </div>

      {/* Chronological Feed */}
      <div className="space-y-6">
        {Object.keys(groupedByDate).length === 0 ? (
          <div className="bg-white rounded-lg border border-slate-200 p-12 text-center shadow-subtle space-y-3">
            <HelpCircle className="w-10 h-10 text-slate-400 mx-auto" />
            <h3 className="text-sm font-semibold text-slate-900">
              No confirmed observations found
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              If you have recently uploaded documents, visit the Review screen to verify and confirm extractions into your timeline.
            </p>
            <button
              onClick={() => setActiveScreen('review')}
              className="text-xs font-semibold text-teal-700 hover:underline"
            >
              Go to Review Extraction →
            </button>
          </div>
        ) : (
          Object.entries(groupedByDate).map(([date, dateObs]) => (
            <div key={date} className="space-y-3">
              {/* Date Header Stamp */}
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-teal-600 ring-4 ring-teal-100"></div>
                <h3 className="text-xs font-bold font-mono tracking-wide uppercase text-slate-800">
                  {new Date(date + 'T00:00:00').toLocaleDateString('en-US', {
                    weekday: 'short',
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })}
                </h3>
                <span className="text-[11px] text-slate-400 font-mono">
                  ({dateObs.length} {dateObs.length === 1 ? 'measurement' : 'measurements'})
                </span>
                <div className="flex-1 h-px bg-slate-200 ml-2"></div>
              </div>

              {/* Grid of Observation Cards for this date */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 pl-5">
                {dateObs.map((obs) => {
                  // Reference range evaluation
                  let refStatus: 'normal' | 'high' | 'low' | 'unknown' = 'unknown';
                  if (obs.valueNumeric !== null) {
                    if (obs.referenceHigh !== null && obs.valueNumeric > obs.referenceHigh) {
                      refStatus = 'high';
                    } else if (obs.referenceLow !== null && obs.valueNumeric < obs.referenceLow) {
                      refStatus = 'low';
                    } else if (obs.referenceLow !== null || obs.referenceHigh !== null) {
                      refStatus = 'normal';
                    }
                  }

                  return (
                    <div
                      key={obs.id}
                      className="bg-white rounded-lg border border-slate-200/90 p-4 shadow-subtle hover:border-slate-300 transition-colors space-y-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h4 className="text-sm font-bold text-slate-900">
                            {obs.canonicalTestName}
                          </h4>
                          <p className="text-[11px] text-slate-400 font-mono truncate">
                            {obs.rawTestName}
                          </p>
                        </div>

                        {refStatus === 'high' && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                            <ArrowUpRight className="w-3 h-3" />
                            Above Ref
                          </span>
                        )}
                        {refStatus === 'low' && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                            <ArrowDownRight className="w-3 h-3" />
                            Below Ref
                          </span>
                        )}
                        {refStatus === 'normal' && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle className="w-3 h-3" />
                            Within Ref
                          </span>
                        )}
                      </div>

                      <div className="flex items-baseline gap-1.5">
                        <span className="text-2xl font-extrabold text-slate-900 font-mono">
                          {obs.valueNumeric !== null ? obs.valueNumeric : obs.valueText}
                        </span>
                        <span className="text-xs text-slate-500 font-mono font-medium">
                          {obs.originalUnit}
                        </span>
                      </div>

                      <div className="text-[11px] text-slate-500 pt-1 border-t border-slate-100 flex items-center justify-between">
                        <span>
                          Ref:{' '}
                          {obs.referenceLow !== null || obs.referenceHigh !== null ? (
                            <span className="font-mono text-slate-700 font-medium">
                              {obs.referenceLow ?? '<'} - {obs.referenceHigh ?? '>'}
                            </span>
                          ) : (
                            <span className="italic text-slate-400">None specified</span>
                          )}
                        </span>

                        {obs.sourceDocumentName && (
                          <button
                            onClick={() => {
                              setSelectedDocumentIdFilter(obs.documentId);
                              setActiveScreen('documents');
                            }}
                            className="text-[11px] text-teal-700 hover:text-teal-900 font-medium flex items-center gap-1 hover:underline truncate max-w-[130px]"
                            title={`Source Document: ${obs.sourceDocumentName}`}
                          >
                            <span className="truncate">{obs.sourceDocumentName}</span>
                            <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
