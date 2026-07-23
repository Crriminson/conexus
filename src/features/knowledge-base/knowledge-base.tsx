"use client";
import { useState, useCallback, useEffect } from "react";
import {
  Search,
  Loader2,
  Sparkles,
  Building2,
  Briefcase,
  FileText,
  Scale,
  Users,
  AlertTriangle,
  Plus,
  Trash2,
  Save,
  Pencil,
  X,
  Bot,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { AIInterview } from "./interview";

const SECTIONS = [
  { id: "Company Profile", label: "Company Profile", icon: Building2 },
  { id: "Financials", label: "Financials", icon: FileText },
  { id: "Business", label: "Business", icon: Briefcase },
  { id: "Management", label: "Management", icon: Users },
  { id: "Legal & Regulatory", label: "Legal & Regulatory", icon: Scale },
  { id: "Risk Factors", label: "Risk Factors", icon: AlertTriangle },
  { id: "AI Interview", label: "AI Interview", icon: Bot },
];

interface KnowledgeBaseFact {
  id: string;
  category: string;
  content: string;
  source: string | null;
  createdAt: string;
}

export default function KnowledgeBasePage({ projectId }: { projectId: string }) {
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState(SECTIONS[0].id);
  const [facts, setFacts] = useState<KnowledgeBaseFact[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Editing state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [editSource, setEditSource] = useState("");

  // New fact state
  const [isAdding, setIsAdding] = useState(false);
  const [newContent, setNewContent] = useState("");
  const [newSource, setNewSource] = useState("");

  const fetchFacts = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/knowledge-base?projectId=${projectId}`);
      if (!res.ok) throw new Error("Failed to load knowledge base");
      const data = await res.json();
      setFacts(data.facts);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [projectId, toast]);

  useEffect(() => {
    fetchFacts();
  }, [fetchFacts]);

  // ─── Actions ────────────────────────────────────────────────────────────────

  const handleSaveEdit = async (id: string) => {
    try {
      const res = await fetch(`/api/knowledge-base/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: activeTab,
          content: editContent,
          source: editSource,
        }),
      });

      if (!res.ok) throw new Error("Failed to update fact");
      const data = await res.json();
      
      setFacts((prev) => prev.map((f) => (f.id === id ? data.fact : f)));
      setEditingId(null);
      toast({ title: "Fact updated" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleCreate = async () => {
    if (!newContent.trim()) {
      toast({ title: "Fact content cannot be empty", variant: "destructive" });
      return;
    }

    try {
      const res = await fetch(`/api/knowledge-base`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          category: activeTab,
          content: newContent,
          source: newSource,
        }),
      });

      if (!res.ok) throw new Error("Failed to add fact");
      const data = await res.json();
      
      setFacts((prev) => [data.fact, ...prev]);
      setIsAdding(false);
      setNewContent("");
      setNewSource("");
      toast({ title: "Fact added successfully" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this fact?")) return;

    try {
      const res = await fetch(`/api/knowledge-base/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete fact");
      
      setFacts((prev) => prev.filter((f) => f.id !== id));
      toast({ title: "Fact deleted" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const startEditing = (fact: KnowledgeBaseFact) => {
    setEditingId(fact.id);
    setEditContent(fact.content);
    setEditSource(fact.source || "");
  };

  // ─── Rendering ──────────────────────────────────────────────────────────────

  const filteredFacts = facts.filter((f) => {
    const matchesCategory = f.category === activeTab;
    const matchesSearch =
      f.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (f.source && f.source.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  if (isLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            Knowledge Base
          </h1>
          <p className="text-slate-500 mt-1">
            Structured company facts extracted from documents. Feeds the auto-drafter.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input 
              placeholder="Search facts..." 
              className="pl-9"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 rounded-md bg-blue-50 border border-blue-100 p-3 text-sm text-blue-800">
        <Sparkles className="h-4 w-4 text-blue-500" />
        <span>
          Facts are automatically extracted from source documents. You can also manually add or edit them below.
        </span>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <TabsList className="w-full justify-start border-b rounded-none h-auto p-0 bg-transparent gap-6 overflow-x-auto">
          {SECTIONS.map((section) => (
            <TabsTrigger
              key={section.id}
              value={section.id}
              className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none rounded-none px-2 py-3 bg-transparent data-[state=active]:bg-transparent"
            >
              <section.icon className="mr-2 h-4 w-4" />
              {section.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <div className="flex-1 py-6 space-y-4">
          {filteredFacts.length === 0 && !isAdding && (
            <div className="text-center py-12 bg-slate-50 rounded-lg border border-dashed border-slate-200">
              <p className="text-slate-500 mb-4">No facts found in this category.</p>
              <Button onClick={() => setIsAdding(true)} variant="outline">
                <Plus className="h-4 w-4 mr-2" /> Add first fact
              </Button>
            </div>
          )}

          <div className="space-y-4">
            {filteredFacts.map((fact) => (
              <Card key={fact.id}>
                <CardContent className="p-4 sm:p-6">
                  {editingId === fact.id ? (
                    <div className="space-y-4">
                      <div>
                        <label className="text-sm font-medium text-slate-700">Fact Content</label>
                        <Textarea 
                          value={editContent}
                          onChange={(e) => setEditContent(e.target.value)}
                          className="mt-1 min-h-[100px]"
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium text-slate-700">Source Document / Reference</label>
                        <Input 
                          value={editSource}
                          onChange={(e) => setEditSource(e.target.value)}
                          placeholder="e.g. FY23 Annual Report, Page 12"
                          className="mt-1"
                        />
                      </div>
                      <div className="flex justify-end gap-2 pt-2">
                        <Button variant="ghost" onClick={() => setEditingId(null)}>Cancel</Button>
                        <Button onClick={() => handleSaveEdit(fact.id)}>
                          <Save className="h-4 w-4 mr-2" /> Save Changes
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <p className="text-slate-900 whitespace-pre-wrap">{fact.content}</p>
                        {fact.source && (
                          <div className="mt-3 flex items-center gap-1.5 text-xs text-slate-500 bg-slate-100 w-fit px-2 py-1 rounded-md">
                            <FileText className="h-3 w-3" />
                            <span>Source: {fact.source}</span>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1 opacity-0 hover:opacity-100 group-hover:opacity-100 transition-opacity focus-within:opacity-100" style={{ opacity: 1 }}>
                        <Button variant="ghost" size="icon" onClick={() => startEditing(fact)}>
                          <Pencil className="h-4 w-4 text-slate-400" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(fact.id)}>
                          <Trash2 className="h-4 w-4 text-red-400" />
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}

            {isAdding && (
              <Card className="border-primary bg-blue-50/50">
                <CardContent className="p-4 sm:p-6 space-y-4">
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="font-semibold text-slate-900">Add New Fact</h3>
                    <Button variant="ghost" size="icon" onClick={() => setIsAdding(false)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-700">Fact Content</label>
                    <Textarea 
                      value={newContent}
                      onChange={(e) => setNewContent(e.target.value)}
                      placeholder="Enter the factual statement..."
                      className="mt-1 min-h-[100px] bg-white"
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-700">Source Document / Reference (Optional)</label>
                    <Input 
                      value={newSource}
                      onChange={(e) => setNewSource(e.target.value)}
                      placeholder="e.g. FY23 Annual Report, Page 12"
                      className="mt-1 bg-white"
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <Button variant="ghost" onClick={() => setIsAdding(false)}>Cancel</Button>
                    <Button onClick={handleCreate}>
                      <Plus className="h-4 w-4 mr-2" /> Add Fact
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {filteredFacts.length > 0 && !isAdding && (
              <Button 
                variant="outline" 
                className="w-full border-dashed py-8 text-slate-500 hover:text-slate-900 hover:border-slate-400"
                onClick={() => setIsAdding(true)}
              >
                <Plus className="h-4 w-4 mr-2" /> Add another fact to {activeTab}
              </Button>
            )}
          </div>
        </div>
      </Tabs>
      
      {activeTab === "AI Interview" && (
        <div className="flex-1 py-6">
          <AIInterview projectId={projectId} onFactsUpdated={fetchFacts} />
        </div>
      )}
    </div>
  );
}