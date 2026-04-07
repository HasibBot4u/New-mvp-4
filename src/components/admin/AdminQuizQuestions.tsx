import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { Plus, Edit2, Trash2, CheckCircle, XCircle } from 'lucide-react';
import { useToast } from '../ui/Toast';

interface AdminQuizQuestionsProps {
  quizId: string;
  quizTitle: string;
  onClose: () => void;
}

export const AdminQuizQuestions: React.FC<AdminQuizQuestionsProps> = ({ quizId, quizTitle, onClose }) => {
  const { showToast } = useToast();
  const [questions, setQuestions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<any>(null);
  const [formData, setFormData] = useState<any>({
    question_text: '',
    marks: 1,
    display_order: 0,
    explanation: '',
    options: [
      { option_text: '', is_correct: true },
      { option_text: '', is_correct: false },
      { option_text: '', is_correct: false },
      { option_text: '', is_correct: false }
    ]
  });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchQuestions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quizId]);

  const fetchQuestions = async () => {
    setIsLoading(true);
    try {
      const { data: questionsData, error: questionsError } = await supabase
        .from('questions')
        .select('*')
        .eq('quiz_id', quizId)
        .order('display_order', { ascending: true });
        
      if (questionsError) {
        if (questionsError.code === 'PGRST205' || questionsError.message?.includes('schema cache')) {
          setQuestions([]);
          return;
        }
        throw questionsError;
      }
      
      if (questionsData && questionsData.length > 0) {
        const questionIds = questionsData.map(q => q.id);
        const { data: optionsData, error: optionsError } = await supabase
          .from('question_options')
          .select('*')
          .in('question_id', questionIds);
          
        if (optionsError) throw optionsError;
        
        const questionsWithOptions = questionsData.map(q => ({
          ...q,
          options: optionsData?.filter(o => o.question_id === q.id) || []
        }));
        
        setQuestions(questionsWithOptions);
      } else {
        setQuestions([]);
      }
    } catch (err) {
      console.error('Error fetching questions:', err);
      showToast('Failed to load questions');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAdd = () => {
    setEditingQuestion(null);
    setFormData({
      question_text: '',
      marks: 1,
      display_order: questions.length + 1,
      explanation: '',
      options: [
        { option_text: '', is_correct: true },
        { option_text: '', is_correct: false },
        { option_text: '', is_correct: false },
        { option_text: '', is_correct: false }
      ]
    });
    setIsModalOpen(true);
  };

  const handleEdit = (question: any) => {
    setEditingQuestion(question);
    
    // Ensure we have at least 4 options for the form
    const formOptions = [...(question.options || [])];
    while (formOptions.length < 4) {
      formOptions.push({ option_text: '', is_correct: false });
    }
    
    setFormData({
      question_text: question.question_text,
      marks: question.marks,
      display_order: question.display_order,
      explanation: question.explanation || '',
      options: formOptions
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this question?')) return;
    
    try {
      const { error } = await supabase.from('questions').delete().eq('id', id);
      if (error) throw error;
      
      await fetchQuestions();
      showToast('Question deleted successfully');
    } catch (error) {
      console.error('Error deleting question:', error);
      showToast('Failed to delete question');
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate options
    const validOptions = formData.options.filter((o: any) => o.option_text.trim() !== '');
    if (validOptions.length < 2) {
      showToast('Please provide at least 2 options');
      return;
    }
    
    if (!validOptions.some((o: any) => o.is_correct)) {
      showToast('Please mark at least one option as correct');
      return;
    }
    
    setIsSaving(true);
    try {
      let questionId = editingQuestion?.id;
      
      const questionData = {
        quiz_id: quizId,
        question_text: formData.question_text,
        marks: formData.marks,
        display_order: formData.display_order,
        explanation: formData.explanation
      };
      
      if (editingQuestion) {
        const { error } = await supabase.from('questions').update(questionData).eq('id', questionId);
        if (error) throw error;
        
        // Delete existing options
        const { error: deleteError } = await supabase.from('question_options').delete().eq('question_id', questionId);
        if (deleteError) throw deleteError;
      } else {
        const { data, error } = await supabase.from('questions').insert(questionData).select().single();
        if (error) throw error;
        questionId = data.id;
      }
      
      // Insert new options
      const optionsToInsert = validOptions.map((o: any) => ({
        question_id: questionId,
        option_text: o.option_text,
        is_correct: o.is_correct
      }));
      
      const { error: optionsError } = await supabase.from('question_options').insert(optionsToInsert);
      if (optionsError) throw optionsError;
      
      setIsModalOpen(false);
      await fetchQuestions();
      showToast(`Question ${editingQuestion ? 'updated' : 'added'} successfully`);
    } catch (error) {
      console.error('Error saving question:', error);
      showToast('Failed to save question');
    } finally {
      setIsSaving(false);
    }
  };

  const updateOption = (index: number, field: string, value: any) => {
    const newOptions = [...formData.options];
    if (field === 'is_correct') {
      // If setting this to true, set others to false (single correct answer)
      if (value === true) {
        newOptions.forEach(o => o.is_correct = false);
      }
    }
    newOptions[index] = { ...newOptions[index], [field]: value };
    setFormData({ ...formData, options: newOptions });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-background rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div>
            <h2 className="text-xl font-bold text-text-primary">Manage Questions</h2>
            <p className="text-sm text-text-secondary">Quiz: {quizTitle}</p>
          </div>
          <div className="flex items-center gap-3">
            <Button onClick={handleAdd} className="flex items-center gap-2">
              <Plus size={16} />
              Add Question
            </Button>
            <button onClick={onClose} className="text-text-secondary hover:text-text-primary">
              <XCircle size={24} />
            </button>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-6">
          {isLoading ? (
            <div className="text-center py-8 text-text-secondary">Loading questions...</div>
          ) : questions.length === 0 ? (
            <div className="text-center py-12 bg-surface rounded-lg border border-border border-dashed">
              <p className="text-text-secondary mb-4">No questions added yet.</p>
              <Button onClick={handleAdd}>Add Your First Question</Button>
            </div>
          ) : (
            <div className="space-y-4">
              {questions.map((q, index) => (
                <div key={q.id} className="bg-surface border border-border rounded-lg p-4">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex gap-3">
                      <span className="bg-primary/10 text-primary font-bold w-8 h-8 rounded-full flex items-center justify-center shrink-0">
                        {q.display_order || index + 1}
                      </span>
                      <div>
                        <h3 className="font-medium text-text-primary">{q.question_text}</h3>
                        <p className="text-xs text-text-secondary mt-1">Marks: {q.marks}</p>
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => handleEdit(q)}>
                        <Edit2 size={14} />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-red-500 hover:text-red-600" onClick={() => handleDelete(q.id)}>
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </div>
                  
                  <div className="pl-11 grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {q.options?.map((opt: any) => (
                      <div key={opt.id} className={`p-2 rounded border text-sm flex items-start gap-2 ${opt.is_correct ? 'bg-green-500/10 border-green-500/30 text-green-700' : 'bg-background border-border text-text-secondary'}`}>
                        {opt.is_correct ? <CheckCircle size={16} className="shrink-0 mt-0.5" /> : <div className="w-4 h-4 rounded-full border border-border shrink-0 mt-0.5" />}
                        <span>{opt.option_text}</span>
                      </div>
                    ))}
                  </div>
                  
                  {q.explanation && (
                    <div className="pl-11 mt-3 text-sm text-text-secondary bg-background p-2 rounded border border-border">
                      <span className="font-medium">Explanation:</span> {q.explanation}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingQuestion ? 'Edit Question' : 'Add Question'}
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1">Question Text</label>
            <textarea
              required
              value={formData.question_text}
              onChange={(e) => setFormData({ ...formData, question_text: e.target.value })}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              rows={3}
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1">Marks</label>
              <input
                type="number"
                required
                min="1"
                value={formData.marks}
                onChange={(e) => setFormData({ ...formData, marks: parseInt(e.target.value) || 1 })}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1">Display Order</label>
              <input
                type="number"
                required
                value={formData.display_order}
                onChange={(e) => setFormData({ ...formData, display_order: parseInt(e.target.value) || 0 })}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>
          
          <div className="space-y-3 pt-2">
            <label className="block text-sm font-medium text-text-primary">Options</label>
            {formData.options.map((option: any, index: number) => (
              <div key={index} className="flex items-center gap-3">
                <input
                  type="radio"
                  name="correct_option"
                  checked={option.is_correct}
                  onChange={(e) => updateOption(index, 'is_correct', e.target.checked)}
                  className="w-4 h-4 text-primary focus:ring-primary border-border"
                />
                <input
                  type="text"
                  value={option.option_text}
                  onChange={(e) => updateOption(index, 'option_text', e.target.value)}
                  placeholder={`Option ${index + 1}`}
                  className={`flex-1 rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-1 ${
                    option.is_correct 
                      ? 'border-green-500 bg-green-50 focus:border-green-500 focus:ring-green-500' 
                      : 'border-border bg-background focus:border-primary focus:ring-primary'
                  }`}
                  required={index < 2} // First two options are required
                />
              </div>
            ))}
          </div>
          
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1">Explanation (Optional)</label>
            <textarea
              value={formData.explanation}
              onChange={(e) => setFormData({ ...formData, explanation: e.target.value })}
              placeholder="Explain why the correct answer is correct..."
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              rows={2}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-border mt-6">
            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save Question'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
