import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { KeyRound, Plus, Trash2, Copy, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { useToast } from '../../components/ui/Toast';

interface EnrollmentCode {
  id: string;
  code: string;
  description: string;
  max_uses: number;
  uses_count: number;
  is_active: boolean;
  expires_at: string | null;
  created_at: string;
}

export const AdminEnrollment: React.FC = () => {
  const [codes, setCodes] = useState<EnrollmentCode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [newCodeDesc, setNewCodeDesc] = useState('');
  const [newCodeMaxUses, setNewCodeMaxUses] = useState(1);
  const { showToast } = useToast();

  const fetchCodes = React.useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('enrollment_codes')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCodes(data || []);
    } catch (error) {
      console.error('Error fetching codes:', error);
      showToast('Failed to fetch enrollment codes');
    } finally {
      setIsLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchCodes();
  }, [fetchCodes]);

  const generateCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsGenerating(true);

    try {
      // Generate a random 8-character alphanumeric code
      const code = Math.random().toString(36).substring(2, 10).toUpperCase();

      const { data, error } = await supabase
        .from('enrollment_codes')
        .insert({
          code,
          description: newCodeDesc,
          max_uses: newCodeMaxUses,
        })
        .select()
        .single();

      if (error) throw error;

      setCodes([data, ...codes]);
      setNewCodeDesc('');
      setNewCodeMaxUses(1);
      showToast('Enrollment code generated successfully');
    } catch (error) {
      console.error('Error generating code:', error);
      showToast('Failed to generate enrollment code');
    } finally {
      setIsGenerating(false);
    }
  };

  const toggleCodeStatus = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('enrollment_codes')
        .update({ is_active: !currentStatus })
        .eq('id', id);

      if (error) throw error;

      setCodes(codes.map(c => c.id === id ? { ...c, is_active: !currentStatus } : c));
      showToast(`Code ${!currentStatus ? 'activated' : 'deactivated'}`);
    } catch (error) {
      console.error('Error toggling code status:', error);
      showToast('Failed to update code status');
    }
  };

  const deleteCode = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this code?')) return;

    try {
      const { error } = await supabase
        .from('enrollment_codes')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setCodes(codes.filter(c => c.id !== id));
      showToast('Code deleted successfully');
    } catch (error) {
      console.error('Error deleting code:', error);
      showToast('Failed to delete code');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    showToast('Code copied to clipboard');
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Enrollment Codes</h1>
          <p className="text-text-secondary">Generate and manage access codes for students.</p>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-text-primary mb-4">Generate New Code</h2>
        <form onSubmit={generateCode} className="flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-text-secondary mb-1">
              Description / Batch Name
            </label>
            <input
              type="text"
              value={newCodeDesc}
              onChange={(e) => setNewCodeDesc(e.target.value)}
              placeholder="e.g., Spring 2026 Cohort"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-text-primary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              required
            />
          </div>
          <div className="w-32">
            <label className="block text-sm font-medium text-text-secondary mb-1">
              Max Uses
            </label>
            <input
              type="number"
              min="1"
              value={newCodeMaxUses}
              onChange={(e) => setNewCodeMaxUses(parseInt(e.target.value) || 1)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-text-primary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              required
            />
          </div>
          <button
            type="submit"
            disabled={isGenerating}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
          >
            {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Generate
          </button>
        </form>
      </div>

      <div className="rounded-xl border border-border bg-surface shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-background/50 text-text-secondary">
              <tr>
                <th className="px-6 py-3 font-medium">Code</th>
                <th className="px-6 py-3 font-medium">Description</th>
                <th className="px-6 py-3 font-medium">Uses</th>
                <th className="px-6 py-3 font-medium">Status</th>
                <th className="px-6 py-3 font-medium">Created</th>
                <th className="px-6 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {codes.map((code) => (
                <tr key={code.id} className="hover:bg-background/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-primary">{code.code}</span>
                      <button
                        onClick={() => copyToClipboard(code.code)}
                        className="text-text-secondary hover:text-primary transition-colors"
                        title="Copy code"
                      >
                        <Copy className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-text-primary">{code.description}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                      code.uses_count >= code.max_uses ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
                    }`}>
                      {code.uses_count} / {code.max_uses}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => toggleCodeStatus(code.id, code.is_active)}
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium transition-colors ${
                        code.is_active
                          ? 'bg-green-100 text-green-700 hover:bg-green-200'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {code.is_active ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                      {code.is_active ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                  <td className="px-6 py-4 text-text-secondary">
                    {new Date(code.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => deleteCode(code.id)}
                      className="text-red-500 hover:text-red-700 transition-colors p-1 rounded-md hover:bg-red-50"
                      title="Delete code"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {codes.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-text-secondary">
                    <KeyRound className="mx-auto h-8 w-8 mb-2 opacity-50" />
                    <p>No enrollment codes generated yet.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
