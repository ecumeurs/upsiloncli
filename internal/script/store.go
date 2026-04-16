package script

import "sync"

// SharedStore allows concurrent agents to share state.
type SharedStore struct {
	mu   sync.RWMutex
	data map[string]interface{}
}

func NewSharedStore() *SharedStore {
	return &SharedStore{
		data: make(map[string]interface{}),
	}
}

func (s *SharedStore) Set(key string, value interface{}) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.data[key] = value
}

func (s *SharedStore) Get(key string) (interface{}, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	val, ok := s.data[key]
	return val, ok
}
