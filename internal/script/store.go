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

// AtomicIncrement increments an integer value in the store and returns the new value.
// If the key doesn't exist or isn't an integer, it starts from 0.
func (s *SharedStore) AtomicIncrement(key string, delta int) int {
	s.mu.Lock()
	defer s.mu.Unlock()
	
	val, ok := s.data[key]
	current := 0
	if ok {
		if c, ok := val.(int); ok {
			current = c
		}
	}
	
	newVal := current + delta
	s.data[key] = newVal
	return newVal
}
